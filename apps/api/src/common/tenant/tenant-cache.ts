import { Injectable } from '@nestjs/common';

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/** Small per-process TTL cache. Enough for one instance; swap for Redis when there are many. */
@Injectable()
export class TtlCache {
  private readonly map = new Map<string, Entry<unknown>>();

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
    this.map.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.map.keys()) if (key.startsWith(prefix)) this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}
