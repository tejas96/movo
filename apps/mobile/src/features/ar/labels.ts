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

/** Typed translation keys for nav node kinds that have no name of their own. */
const NODE_KEYS = {
  door: 'ar:node.door',
  lift: 'ar:node.lift',
  stair: 'ar:node.stair',
  entrance: 'ar:node.entrance',
  space: 'ar:node.space',
  shop: 'ar:node.shop',
  parking_slot: 'ar:node.parking_slot',
  two_wheeler_area: 'ar:node.two_wheeler_area',
} as const;

export type NodeKey = (typeof NODE_KEYS)[keyof typeof NODE_KEYS];

export function nodeKey(kind: string): NodeKey {
  return (NODE_KEYS as Record<string, NodeKey>)[kind] ?? NODE_KEYS.space;
}
