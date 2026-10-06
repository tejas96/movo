import { kv } from '../../core/storage/mmkv';

const KEY = 'movo.welcome.seen';

/** True once the person has left the Welcome slides on this device. */
export function isWelcomeSeen(): boolean {
  return kv.get(KEY) === '1';
}

export function markWelcomeSeen(): void {
  kv.set(KEY, '1');
}
