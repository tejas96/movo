import { queryClient } from '../api/query-client';
import type { RootNav } from '../navigation/types';
import { useTenantStore } from '../tenant/tenant.store';

/** What a notification's `data` may carry. Push data arrives with every value as a string. */
export interface NotificationTarget {
  screen?: string;
  societyId?: string;
  notificationId?: string;
  noticeId?: string;
  alertId?: string;
  meetingId?: string;
  eventId?: string;
  billId?: string;
  paymentId?: string;
  expenseId?: string;
  dutyId?: string;
  taskId?: string;
  listingId?: string;
  orderId?: string;
}

type Navigate = Pick<RootNav, 'navigate'>;

/**
 * Opens the screen a notification points at. Shared by the notification center and push taps.
 * Returns false when the data names no known screen.
 */
export function openNotificationTarget(nav: Navigate, raw: unknown): boolean {
  const data = (raw ?? {}) as NotificationTarget;
  if (data.screen === 'notice' && data.noticeId)
    nav.navigate('NoticeDetail', { noticeId: data.noticeId });
  else if (data.screen === 'alert' && data.alertId)
    nav.navigate('AlertDetail', { alertId: data.alertId });
  else if (data.screen === 'meeting' && data.meetingId)
    nav.navigate('MeetingDetail', { meetingId: data.meetingId });
  else if (data.screen === 'event' && data.eventId)
    nav.navigate('EventDetail', { eventId: data.eventId });
  else if (data.screen === 'bill' && data.billId) nav.navigate('Bill', { billId: data.billId });
  else if (data.screen === 'payment' && data.paymentId)
    nav.navigate('Receipt', { paymentId: data.paymentId });
  else if (data.screen === 'expense' && data.expenseId)
    nav.navigate('ExpenseDetail', { expenseId: data.expenseId });
  else if (data.screen === 'duty' && data.dutyId)
    nav.navigate('DutyDetail', { dutyId: data.dutyId });
  else if (data.screen === 'task' && data.taskId)
    nav.navigate('TaskDetail', { taskId: data.taskId });
  else if (data.screen === 'listing' && data.listingId)
    nav.navigate('Listing', { listingId: data.listingId });
  else if (data.screen === 'order' && data.orderId)
    nav.navigate('OrderDetail', { orderId: data.orderId });
  else if (data.screen === 'manage/join-requests') nav.navigate('JoinRequests');
  else return false;
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
