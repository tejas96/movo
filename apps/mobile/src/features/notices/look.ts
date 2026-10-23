import type { NoticeCategory, NoticeSummary } from '@movo/contracts';
import type { ArtName, IconMotion, IconName } from '@movo/design-system';

/** How each notice category looks in Soft Glow: its art tile, icon and how the icon moves. */
export const CATEGORY_LOOK: Record<
  NoticeCategory,
  { tile: ArtName; icon: IconName; motion: IconMotion; dot: string }
> = {
  WATER: { tile: 'tileBlue', icon: 'water', motion: 'wiggle', dot: '#6C7FD8' },
  ELECTRICITY: { tile: 'tileFlame', icon: 'electricity', motion: 'flick', dot: '#E0962F' },
  MAINTENANCE: { tile: 'tileSage', icon: 'tools', motion: 'bob', dot: '#4E9A55' },
  SECURITY: { tile: 'tileBlue', icon: 'security', motion: 'bob', dot: '#6C7FD8' },
  EVENT: { tile: 'tileFlame', icon: 'events', motion: 'flick', dot: '#F06A2E' },
  FINANCE: { tile: 'tileSage', icon: 'wallet', motion: 'bob', dot: '#4E9A55' },
  EMERGENCY: { tile: 'tilePink', icon: 'emergency', motion: 'wobble', dot: '#D63B3B' },
  GENERAL: { tile: 'tilePink', icon: 'notices', motion: 'wobble', dot: '#C2457A' },
  OTHER: { tile: 'tilePink', icon: 'notices', motion: 'wobble', dot: '#C2457A' },
};

export type NoticeFilter = 'all' | 'urgent' | NoticeCategory;

export function matchesFilter(n: NoticeSummary, f: NoticeFilter): boolean {
  if (f === 'all') return true;
  if (f === 'urgent') return n.priority !== 'NORMAL';
  return n.category === f;
}

/** Within the last 7 days. */
export function isThisWeek(iso: string | null, now: number = Date.now()): boolean {
  return Boolean(iso) && now - Date.parse(iso as string) < 7 * 86_400_000;
}
