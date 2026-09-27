/** Typed translation keys for level names, so `t()` accepts them. */
const LEVEL_KEYS = {
  L0: 'ar:levels.L0',
  L1: 'ar:levels.L1',
  L2: 'ar:levels.L2',
  L3: 'ar:levels.L3',
  L4: 'ar:levels.L4',
  L5: 'ar:levels.L5',
  L6: 'ar:levels.L6',
} as const;

export type LevelKey = (typeof LEVEL_KEYS)[keyof typeof LEVEL_KEYS];

export function levelKey(id: string): LevelKey {
  return (LEVEL_KEYS as Record<string, LevelKey>)[id] ?? LEVEL_KEYS.L0;
}
