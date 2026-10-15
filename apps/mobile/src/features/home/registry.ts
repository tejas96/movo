import type { AttentionItem } from '@movo/contracts';
import type {
  AttentionEntries,
  AttentionEntry,
  FeatureHome,
  QuickTile,
} from '../../core/home/types';
import { directoryHome } from '../directory/home';
import { dutiesHome } from '../duties/home';
import { emergencyHome } from '../emergency/home';
import { expensesHome } from '../expenses/home';
import { manageHome } from '../manage/home';
import { marketHome } from '../market/home';
import { meHome } from '../me/home';
import { moneyHome } from '../money/home';
import { noticesHome } from '../notices/home';
import { servicesHome } from '../services/home';
import { tasksHome } from '../tasks/home';

/** The AR guide lives on its own track (features/ar), so its tile is declared here. */
const arHome: FeatureHome = {
  quick: [
    { key: 'ar', icon: 'map', label: (t) => t('home:quick.ar'), go: (nav) => nav.navigate('AR') },
  ],
};

/**
 * Every feature's part of Home. Quick tiles show in this order; attention rows follow the order
 * the server sends. Adding a feature: write its `home.tsx` and add it here.
 */
const featureHomes: readonly FeatureHome[] = [
  directoryHome,
  servicesHome,
  emergencyHome,
  arHome,
  marketHome,
  manageHome,
  moneyHome,
  dutiesHome,
  tasksHome,
  expensesHome,
  noticesHome,
  meHome,
];

const attention: AttentionEntries = Object.assign({}, ...featureHomes.map((f) => f.attention));

export const quickTiles: readonly QuickTile[] = featureHomes.flatMap((f) => f.quick ?? []);

/** The entry for an item's type, or undefined for a type this app version does not know. */
export function attentionEntry(
  item: AttentionItem,
): AttentionEntry<AttentionItem['type']> | undefined {
  return attention[item.type] as AttentionEntry<AttentionItem['type']> | undefined;
}

export function attentionKey(item: AttentionItem): string {
  const id = attentionEntry(item)?.id;
  return id ? `${item.type}-${id(item)}` : item.type;
}

/** The item for the black card: the one whose type has the lowest hero priority. */
export function pickHero(items: readonly AttentionItem[]): AttentionItem | undefined {
  let best: { item: AttentionItem; priority: number } | undefined;
  for (const item of items) {
    const priority = attentionEntry(item)?.hero?.priority;
    if (priority !== undefined && (!best || priority < best.priority)) best = { item, priority };
  }
  return best?.item;
}
