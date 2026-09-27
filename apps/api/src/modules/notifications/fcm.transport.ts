import { Logger } from '@nestjs/common';
import { importPKCS8, SignJWT } from 'jose';
import { z } from 'zod';
import { type PushMessage, type PushResult, PushTransport } from './push.transport';

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const CONCURRENCY = 8;
/** Refresh the access token this long before Google says it expires. */
const EXPIRY_SKEW_MS = 60_000;

const ServiceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
  token_uri: z.string().url().optional(),
});
export type ServiceAccount = z.infer<typeof ServiceAccountSchema>;

/** The FIREBASE_SERVICE_ACCOUNT_JSON value as a service account, or null when empty or malformed. */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = ServiceAccountSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type Fetch = typeof fetch;

/** Outcome of one token. */
type TokenOutcome =
  | { kind: 'sent' }
  | { kind: 'invalid'; error: string }
  | { kind: 'retry'; error: string }
  | { kind: 'failed'; error: string };

/**
 * Firebase Cloud Messaging over the HTTP v1 API. One request per token (v1 has no multicast),
 * a few at a time. Auth is a service-account JWT exchanged for an OAuth access token, signed with
 * jose (already a dependency), cached until shortly before it expires.
 */
export class FcmPushTransport extends PushTransport {
  readonly configured = true;
  private readonly logger = new Logger('Push');
  private readonly endpoint: string;
  private accessToken: { value: string; expiresAt: number } | null = null;
  private pendingToken: Promise<string> | null = null;

  constructor(
    private readonly account: ServiceAccount,
    private readonly fetchImpl: Fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    super();
    this.endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`;
  }

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const jobs = messages.flatMap((m) => m.tokens.map((token) => ({ m, token })));
    const outcomes = new Map<string, { token: string; outcome: TokenOutcome }[]>();

    let accessToken: string;
    try {
      accessToken = await this.getAccessToken();
    } catch (error) {
      const msg = `auth: ${errorText(error)}`;
      this.logger.warn(`FCM ${msg}`);
      return messages.map((m) => ({ deliveryId: m.deliveryId, status: 'RETRY', error: msg }));
    }

    await pool(jobs, CONCURRENCY, async ({ m, token }) => {
      let outcome = await this.sendOne(m, token, accessToken);
      if (outcome.kind === 'retry' && outcome.error.startsWith('401')) {
        // The cached access token was revoked or expired early. Fetch a new one once.
        this.accessToken = null;
        try {
          accessToken = await this.getAccessToken();
          outcome = await this.sendOne(m, token, accessToken);
        } catch (error) {
          outcome = { kind: 'retry', error: `auth: ${errorText(error)}` };
        }
      }
      const list = outcomes.get(m.deliveryId) ?? [];
      list.push({ token, outcome });
      outcomes.set(m.deliveryId, list);
    });

    return messages.map((m) => summarise(m, outcomes.get(m.deliveryId) ?? []));
  }

  private async sendOne(m: PushMessage, token: string, accessToken: string): Promise<TokenOutcome> {
    const emergency = m.category === 'EMERGENCY';
    const body = {
      message: {
        token,
        notification: { title: m.title, body: m.body },
        data: { ...m.data, category: m.category },
        android: {
          priority: emergency ? 'HIGH' : 'NORMAL',
          notification: {
            channel_id: emergency ? 'emergency' : 'default',
            ...(emergency ? { default_sound: true } : {}),
          },
        },
      },
    };
    let res: Response;
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      return { kind: 'retry', error: `network: ${errorText(error)}` };
    }
    if (res.ok) return { kind: 'sent' };
    return classify(res.status, await res.text().catch(() => ''));
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt - EXPIRY_SKEW_MS > this.now())
      return this.accessToken.value;
    if (!this.pendingToken) {
      this.pendingToken = this.fetchAccessToken().finally(() => {
        this.pendingToken = null;
      });
    }
    return this.pendingToken;
  }

  private async fetchAccessToken(): Promise<string> {
    const tokenUri = this.account.token_uri ?? DEFAULT_TOKEN_URI;
    const iat = Math.floor(this.now() / 1000);
    const key = await importPKCS8(this.account.private_key, 'RS256');
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(this.account.client_email)
      .setAudience(tokenUri)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 3600)
      .sign(key);
    const res = await this.fetchImpl(tokenUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !json.access_token)
      throw new Error(`token endpoint ${res.status} ${json.error ?? ''}`.trim());
    this.accessToken = {
      value: json.access_token,
      expiresAt: this.now() + (json.expires_in ?? 3600) * 1000,
    };
    return json.access_token;
  }
}

/** Maps an FCM v1 error response to what the job should do with the token. */
export function classify(status: number, text: string): TokenOutcome {
  let fcmStatus = '';
  let errorCode = '';
  let message = '';
  try {
    const json = JSON.parse(text) as {
      error?: {
        status?: string;
        message?: string;
        details?: { '@type'?: string; errorCode?: string }[];
      };
    };
    fcmStatus = json.error?.status ?? '';
    message = json.error?.message ?? '';
    errorCode = json.error?.details?.find((d) => d.errorCode)?.errorCode ?? '';
  } catch {
    // not JSON; status code decides
  }
  const error = `${status} ${errorCode || fcmStatus}${message ? `: ${message}` : ''}`.trim();
  const code = errorCode || fcmStatus;
  if (code === 'UNREGISTERED' || code === 'SENDER_ID_MISMATCH') return { kind: 'invalid', error };
  // INVALID_ARGUMENT also covers a malformed payload. Only drop the token when FCM says it is the token.
  if (code === 'INVALID_ARGUMENT' && /registration token/i.test(message))
    return { kind: 'invalid', error };
  if (status === 401 || status === 429 || status >= 500) return { kind: 'retry', error };
  return { kind: 'failed', error };
}

function summarise(m: PushMessage, list: { token: string; outcome: TokenOutcome }[]): PushResult {
  const invalidTokens = list.filter((x) => x.outcome.kind === 'invalid').map((x) => x.token);
  const firstError = list.find((x) => x.outcome.kind !== 'sent')?.outcome;
  const error = firstError && 'error' in firstError ? firstError.error : undefined;
  const base = {
    deliveryId: m.deliveryId,
    ...(error ? { error } : {}),
    ...(invalidTokens.length ? { invalidTokens } : {}),
  };
  if (list.some((x) => x.outcome.kind === 'sent')) return { ...base, status: 'SENT' };
  if (list.length === 0) return { ...base, status: 'SKIPPED', error: 'no device' };
  if (list.some((x) => x.outcome.kind === 'retry')) return { ...base, status: 'RETRY' };
  return { ...base, status: 'FAILED' };
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
