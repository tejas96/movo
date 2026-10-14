import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { loadEnv } from '../../config/env';
import { PrismaService } from '../prisma/prisma.service';

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/** Postgres channel that carries invalidations between API instances. */
export const CACHE_CHANNEL = 'movo_cache';
const RECONNECT_MS = 2_000;

type Op = { op: 'delete' | 'prefix'; key: string } | { op: 'clear' };

/**
 * Small per-process TTL cache (sessions, users, tenant contexts).
 *
 * Every delete is also sent to the other API instances over Postgres LISTEN/NOTIFY, so a
 * logout, a suspension or a role change takes effect on all of them at once, not after the
 * TTL. If the listening connection drops, this instance clears its cache (it may have missed
 * messages) and connects again; while it is down entries still expire by TTL.
 */
@Injectable()
export class TtlCache implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TtlCache.name);
  private readonly map = new Map<string, Entry<unknown>>();
  /** Lets an instance skip its own messages. */
  readonly instanceId = randomUUID();
  private listener: Client | null = null;
  private retry: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.listen();
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    if (this.retry) clearTimeout(this.retry);
    const client = this.listener;
    this.listener = null;
    await client?.end().catch(() => undefined);
  }

  get<T>(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.apply({ op: 'delete', key });
    this.publish({ op: 'delete', key });
  }

  deleteByPrefix(prefix: string): void {
    this.apply({ op: 'prefix', key: prefix });
    this.publish({ op: 'prefix', key: prefix });
  }

  clear(): void {
    this.apply({ op: 'clear' });
    this.publish({ op: 'clear' });
  }

  private apply(op: Op): void {
    if (op.op === 'clear') this.map.clear();
    else if (op.op === 'delete') this.map.delete(op.key);
    else for (const key of this.map.keys()) if (key.startsWith(op.key)) this.map.delete(key);
  }

  /** Fire and forget: the local delete already happened; others still have the TTL. */
  private publish(op: Op): void {
    const payload = JSON.stringify({ from: this.instanceId, ...op });
    this.prisma.$executeRaw`SELECT pg_notify(${CACHE_CHANNEL}, ${payload})`.catch(
      (error: unknown) => this.logger.warn(`cache notify failed: ${(error as Error).message}`),
    );
  }

  private async listen(): Promise<void> {
    if (this.closed) return;
    const client = new Client({ connectionString: loadEnv().DATABASE_URL });
    const lost = (why: string) => {
      if (this.listener !== client) return;
      this.listener = null;
      client.end().catch(() => undefined);
      if (this.closed) return;
      this.logger.warn(`cache listener lost (${why}); clearing the local cache and reconnecting`);
      this.map.clear();
      this.retry = setTimeout(() => void this.listen(), RECONNECT_MS);
      this.retry.unref();
    };
    client.on('error', (error) => lost(error.message));
    client.on('end', () => lost('connection ended'));
    client.on('notification', (msg) => {
      if (msg.channel !== CACHE_CHANNEL || !msg.payload) return;
      try {
        const { from, ...op } = JSON.parse(msg.payload) as Op & { from: string };
        if (from !== this.instanceId) this.apply(op as Op);
      } catch {
        // Not ours; ignore.
      }
    });
    try {
      this.listener = client;
      await client.connect();
      await client.query(`LISTEN ${CACHE_CHANNEL}`);
    } catch (error) {
      lost((error as Error).message);
    }
  }
}
