import { Injectable, Logger } from '@nestjs/common';

export interface PushMessage {
  deliveryId: string;
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface PushResult {
  deliveryId: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  error?: string;
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
