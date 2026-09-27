import { meContract } from '@movo/contracts';
import { useToast } from '@movo/design-system';
import type { RemoteMessage } from '@react-native-firebase/messaging';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { keys } from '../api/keys';
import { queryClient } from '../api/query-client';
import { useSessionStore } from '../auth/session.store';
import { navigationRef } from '../navigation/navigation-ref';
import { openNotificationTarget, switchSocietyFor } from '../notifications/open-target';
import { useMeContext } from '../tenant/hooks';
import {
  initialNotification,
  onForegroundMessage,
  onNotificationTap,
  registerForPush,
  watchTokenRefresh,
} from './push';

/** Give the home screen a moment before the permission dialog appears. */
const REGISTER_DELAY_MS = 1500;

function refreshNotificationViews(): void {
  void queryClient.invalidateQueries({ queryKey: keys.me.notifications });
  // Home summaries (['society', id, 'home']) carry the unread badge and attention items.
  void queryClient.invalidateQueries({
    predicate: (q) => q.queryKey[0] === 'society' && q.queryKey[2] === 'home',
  });
}

/**
 * Wires Firebase messaging into the app. Renders nothing. Without Firebase every call below
 * is a no-op (see push.ts), so the app behaves exactly as before.
 */
export function PushBridge() {
  const { t } = useTranslation('me');
  const toast = useToast();
  const status = useSessionStore((s) => s.status);
  const ctx = useMeContext(status === 'signedIn');
  const activeSocietyIds =
    ctx.data?.memberships.filter((m) => m.status === 'ACTIVE').map((m) => m.society.id) ?? [];
  const ready = status === 'signedIn' && activeSocietyIds.length > 0;
  const [pending, setPending] = useState<RemoteMessage['data'] | null>(null);
  const idsRef = useRef(activeSocietyIds);
  idsRef.current = activeSocietyIds;

  // Register the token once signed in with a society, and keep it fresh.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => void registerForPush().catch(() => {}), REGISTER_DELAY_MS);
    const stop = watchTokenRefresh();
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [ready]);

  // Foreground: the system shows nothing, so a toast, and fresh counts.
  useEffect(
    () =>
      onForegroundMessage((message) => {
        refreshNotificationViews();
        const title = message.notification?.title ?? t('notifications');
        toast.show(title, 'info');
      }),
    [t, toast],
  );

  // Taps from the background, and the tap that launched the app.
  useEffect(() => {
    void initialNotification().then((m) => m?.data && setPending(m.data));
    return onNotificationTap((m) => m.data && setPending(m.data));
  }, []);

  // Open the target once the signed-in screens exist.
  useEffect(() => {
    if (!pending || !ready || !navigationRef.isReady()) return;
    setPending(null);
    switchSocietyFor(pending, idsRef.current);
    openNotificationTarget(navigationRef, pending);
    const notificationId = typeof pending.notificationId === 'string' ? pending.notificationId : '';
    if (notificationId)
      void api(meContract.markNotificationRead, { params: { notificationId } })
        .then(refreshNotificationViews)
        .catch(() => {});
  }, [pending, ready]);

  return null;
}
