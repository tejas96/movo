import { generateKeyPairSync } from 'node:crypto';
import { decodeJwt } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { classify, FcmPushTransport, parseServiceAccount } from './fcm.transport';
import type { PushMessage } from './push.transport';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = {
  project_id: 'movo-test',
  client_email: 'push@movo-test.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  token_uri: 'https://oauth2.googleapis.com/token',
};

const SEND_URL = 'https://fcm.googleapis.com/v1/projects/movo-test/messages:send';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fcmError(status: number, fcmStatus: string, errorCode?: string, message = 'x') {
  return json(status, {
    error: {
      code: status,
      status: fcmStatus,
      message,
      details: errorCode
        ? [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode }]
        : [],
    },
  });
}

/** fetch mock: the token endpoint answers with a token; sends answer per token from `byToken`. */
function mockFetch(byToken: Record<string, () => Response>) {
  const sends: { token: string; body: Record<string, unknown>; auth: string }[] = [];
  let tokenCalls = 0;
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url) === account.token_uri) {
      tokenCalls++;
      const form = new URLSearchParams(String(init?.body));
      const claims = decodeJwt(form.get('assertion') ?? '');
      expect(claims.iss).toBe(account.client_email);
      expect(claims.aud).toBe(account.token_uri);
      expect(claims.scope).toBe('https://www.googleapis.com/auth/firebase.messaging');
      return json(200, { access_token: `at-${tokenCalls}`, expires_in: 3600 });
    }
    expect(String(url)).toBe(SEND_URL);
    const body = JSON.parse(String(init?.body)) as { message: { token: string } };
    const headers = init?.headers as Record<string, string>;
    sends.push({ token: body.message.token, body, auth: headers.authorization ?? '' });
    return (byToken[body.message.token] ?? (() => json(200, { name: 'ok' })))();
  });
  return { fn: fn as unknown as typeof fetch, sends, tokenCalls: () => tokenCalls };
}

const msg = (over: Partial<PushMessage> = {}): PushMessage => ({
  deliveryId: 'd1',
  category: 'NOTICE',
  tokens: ['tok-a'],
  title: 'Water cut',
  body: 'Tomorrow 10 to 12',
  data: { screen: 'notice', noticeId: 'n1' },
  ...over,
});

describe('parseServiceAccount', () => {
  it('accepts a service account and rejects empty or malformed values', () => {
    expect(parseServiceAccount(JSON.stringify(account))?.project_id).toBe('movo-test');
    expect(parseServiceAccount('')).toBeNull();
    expect(parseServiceAccount('{not json')).toBeNull();
    expect(parseServiceAccount('{"project_id":"x"}')).toBeNull();
  });
});

describe('FcmPushTransport', () => {
  it('sends one HTTP v1 request per token with the Android payload', async () => {
    const f = mockFetch({});
    const t = new FcmPushTransport(account, f.fn);
    const [r] = await t.send([msg({ tokens: ['tok-a', 'tok-b'] })]);
    expect(r).toEqual({ deliveryId: 'd1', status: 'SENT' });
    expect(f.sends.map((s) => s.token).sort()).toEqual(['tok-a', 'tok-b']);
    expect(f.sends[0]?.auth).toBe('Bearer at-1');
    expect(f.sends[0]?.body).toEqual({
      message: {
        token: f.sends[0]?.token,
        notification: { title: 'Water cut', body: 'Tomorrow 10 to 12' },
        data: { screen: 'notice', noticeId: 'n1', category: 'NOTICE' },
        android: { priority: 'NORMAL', notification: { channel_id: 'default' } },
      },
    });
  });

  it('uses the emergency channel and high priority for EMERGENCY', async () => {
    const f = mockFetch({});
    await new FcmPushTransport(account, f.fn).send([msg({ category: 'EMERGENCY' })]);
    expect(f.sends[0]?.body.message).toMatchObject({
      android: {
        priority: 'HIGH',
        notification: { channel_id: 'emergency', default_sound: true },
      },
    });
  });

  it('caches the access token until shortly before it expires', async () => {
    let now = 1_000_000;
    const f = mockFetch({});
    const t = new FcmPushTransport(account, f.fn, () => now);
    await t.send([msg()]);
    await t.send([msg()]);
    expect(f.tokenCalls()).toBe(1);
    now += 3_590_000; // inside the one minute skew
    await t.send([msg()]);
    expect(f.tokenCalls()).toBe(2);
  });

  it('reports dead tokens and still counts the delivery as sent when one device got it', async () => {
    const f = mockFetch({
      dead: () => fcmError(404, 'NOT_FOUND', 'UNREGISTERED'),
      bad: () =>
        fcmError(
          400,
          'INVALID_ARGUMENT',
          'INVALID_ARGUMENT',
          'The registration token is not a valid FCM registration token',
        ),
    });
    const [r] = await new FcmPushTransport(account, f.fn).send([
      msg({ tokens: ['dead', 'ok', 'bad'] }),
    ]);
    expect(r?.status).toBe('SENT');
    expect(r?.invalidTokens?.sort()).toEqual(['bad', 'dead']);
  });

  it('asks for a retry on 429 and 5xx and keeps the token', async () => {
    const f = mockFetch({
      busy: () => fcmError(429, 'RESOURCE_EXHAUSTED', 'QUOTA_EXCEEDED'),
      down: () => fcmError(503, 'UNAVAILABLE', 'UNAVAILABLE'),
    });
    const [r] = await new FcmPushTransport(account, f.fn).send([msg({ tokens: ['busy', 'down'] })]);
    expect(r?.status).toBe('RETRY');
    expect(r?.invalidTokens).toBeUndefined();
  });

  it('fails a malformed payload without deleting the token', async () => {
    const f = mockFetch({ x: () => fcmError(400, 'INVALID_ARGUMENT', undefined, 'bad data key') });
    const [r] = await new FcmPushTransport(account, f.fn).send([msg({ tokens: ['x'] })]);
    expect(r?.status).toBe('FAILED');
    expect(r?.invalidTokens).toBeUndefined();
  });

  it('refreshes the access token once on 401', async () => {
    let first = true;
    const f = mockFetch({
      tok: () => {
        if (first) {
          first = false;
          return fcmError(401, 'UNAUTHENTICATED');
        }
        return json(200, { name: 'ok' });
      },
    });
    const [r] = await new FcmPushTransport(account, f.fn).send([msg({ tokens: ['tok'] })]);
    expect(r?.status).toBe('SENT');
    expect(f.tokenCalls()).toBe(2);
    expect(f.sends[1]?.auth).toBe('Bearer at-2');
  });

  it('retries everything when the token endpoint is down', async () => {
    const fn = vi.fn(async () => json(500, { error: 'backend' })) as unknown as typeof fetch;
    const results = await new FcmPushTransport(account, fn).send([
      msg(),
      msg({ deliveryId: 'd2' }),
    ]);
    expect(results.map((r) => r.status)).toEqual(['RETRY', 'RETRY']);
  });

  it('treats network errors as temporary', async () => {
    const f = mockFetch({
      tok: () => {
        throw new TypeError('fetch failed');
      },
    });
    const [r] = await new FcmPushTransport(account, f.fn).send([msg({ tokens: ['tok'] })]);
    expect(r?.status).toBe('RETRY');
  });
});

describe('classify', () => {
  it('does not delete tokens for a 404 without UNREGISTERED (wrong project id)', () => {
    expect(classify(404, '{"error":{"status":"NOT_FOUND","message":"no project"}}').kind).toBe(
      'failed',
    );
  });
});
