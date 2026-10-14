import { queryClient } from '../api/query-client';
import type { AnyNotificationEntry } from '../navigation/routes';
import type { RootNav } from '../navigation/types';
import { useTenantStore } from '../tenant/tenant.store';

/** What a notification's `data` may carry. Push data arrives with every value as a string. */
export interface NotificationTarget {
  screen?: string;
  societyId?: string;
  notificationId?: string;
  /** The entity id a target names, e.g. `noticeId` (see each feature's `routes.tsx`). */
  [field: string]: string | undefined;
}

type Navigate = Pick<RootNav, 'navigate'>;

let targets: readonly AnyNotificationEntry[] = [];

/** Called once by the route registry with every feature's notification entries. */
export function setNotificationTargets(entries: readonly AnyNotificationEntry[]): void {
  targets = entries;
}

/**
 * Opens the screen a notification points at. Shared by the notification center and push taps.
 * Returns false when the data names no known screen.
 */
export function openNotificationTarget(nav: Navigate, raw: unknown): boolean {
  const data = (raw ?? {}) as NotificationTarget;
  const entry = targets.find((e) => e.kind === data.screen);
  if (!entry) return false;
  // The registry types each entry against its feature's params; here the names are plain strings.
  const go = nav.navigate as (route: string, params?: object) => void;
  if (!entry.param) {
    go(entry.route);
    return true;
  }
  const id = data[entry.param];
  if (!id) return false;
  go(entry.route, { [entry.param]: id });
  return true;
}

/**
 * A notification from another society switches to it first, the same way the society switcher
 * does. Only societies the member is active in (`activeSocietyIds`) are considered.
 */
export function switchSocietyFor(raw: unknown, activeSocietyIds: readonly string[]): void {
  const societyId = (raw as NotificationTarget | null)?.societyId;
  if (!societyId || !activeSocietyIds.includes(societyId)) return;
  const tenant = useTenantStore.getState();
  if (tenant.activeSocietyId === societyId) return;
  tenant.setActiveSocietyId(societyId);
  void queryClient.invalidateQueries({ queryKey: ['society', societyId] });
}
