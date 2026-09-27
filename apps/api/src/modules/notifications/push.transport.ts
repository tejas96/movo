import type { NotificationCategory } from '@movo/contracts';
import { Injectable, Logger } from '@nestjs/common';

export interface PushMessage {
  deliveryId: string;
  category: NotificationCategory;
  tokens: string[];
  title: string;
  body: string;
  /** FCM data payload. Values must be strings. */
  data: Record<string, string>;
}

/**
 * SENT: at least one device accepted it. RETRY: nothing went out because of a temporary error
 * (429, 5xx, network); the job tries again later. FAILED: a permanent error. SKIPPED: not sent on purpose.
 */
export type PushStatus = 'SENT' | 'FAILED' | 'SKIPPED' | 'RETRY';

export interface PushResult {
  deliveryId: string;
  status: PushStatus;
  error?: string;
  /** Tokens FCM says are dead (app uninstalled, token rotated). The job deletes them. */
  invalidTokens?: string[];
}

export abstract class PushTransport {
  abstract readonly configured: boolean;
  abstract send(messages: PushMessage[]): Promise<PushResult[]>;
}

/** Until a Firebase project exists, deliveries are marked SKIPPED and logged. Nothing else changes. */
@Injectable()
export class NoopPushTransport extends PushTransport {
  private readonly logger = new Logger('Push');
  readonly configured = false;

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    for (const m of messages)
      this.logger.debug(`[push not configured] "${m.title}" -> ${m.tokens.length} device(s)`);
    return messages.map((m) => ({
      deliveryId: m.deliveryId,
      status: 'SKIPPED',
      error: 'push not configured',
    }));
  }
}
