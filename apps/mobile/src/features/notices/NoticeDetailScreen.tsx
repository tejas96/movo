import {
  Card,
  Divider,
  IconSquare,
  OptionSheet,
  Pill,
  Screen,
  Skeleton,
  StatusPill,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useCan, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { mediumDate } from '../../core/util/time';
import { useNotice, useNoticeAction } from './api';

type Action = 'edit' | 'pin' | 'unpin' | 'publish' | 'archive';

export function NoticeDetailScreen() {
  const { t } = useTranslation(['notices', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const { noticeId } = useRoute<RouteProp<RootStackParamList, 'NoticeDetail'>>().params;
  const notice = useNotice(societyId, noticeId);
  const action = useNoticeAction(societyId, noticeId);
  const canPublish = useCan('notice.publish');
  const canManageAll = useCan('notice.manage_all');
  const [menu, setMenu] = useState(false);
  const n = notice.data;
  const mine = n?.createdBy.membershipId === tenant.id;
  const canEdit = Boolean(n) && (canManageAll || (canPublish && mine));

  const run = async (a: Action) => {
    if (a === 'edit') {
      nav.navigate('NoticeEditor', { noticeId });
      return;
    }
    try {
      await action.mutateAsync(a);
      if (a === 'archive') {
        toast.show(t('notices:archived'));
        nav.goBack();
      } else if (a === 'publish') toast.show(t('notices:form.published'));
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const options = n
    ? [
        ...(n.status === 'DRAFT'
          ? [{ value: 'publish' as const, label: t('notices:form.publish') }]
          : []),
        { value: 'edit' as const, label: t('common:actions.edit') },
        ...(n.status === 'PUBLISHED'
          ? [
              n.isPinned
                ? { value: 'unpin' as const, label: t('notices:unpin') }
                : { value: 'pin' as const, label: t('notices:form.pin') },
            ]
          : []),
        ...(n.status !== 'ARCHIVED'
          ? [{ value: 'archive' as const, label: t('notices:archive') }]
          : []),
      ]
    : [];

  return (
    <Screen>
      <TitleBar
        title={t('notices:title')}
        onBack={() => nav.goBack()}
        trailing={
          canEdit ? (
            <IconSquare icon="more" variant="linear" onPress={() => setMenu(true)} />
          ) : undefined
        }
      />
      {notice.isLoading || !n ? (
        <View className="mt-6 gap-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-48 rounded-xl" />
        </View>
      ) : (
        <Card className="mt-6">
          <View className="flex-row flex-wrap gap-2">
            <Pill label={t(`notices:category.${n.category}`)} icon="notices" size="sm" />
            {n.priority !== 'NORMAL' ? (
              <StatusPill
                label={t(`notices:priority.${n.priority}`)}
                tone={n.priority === 'EMERGENCY' ? 'danger' : 'warning'}
                dot
              />
            ) : null}
            {n.isPinned ? <StatusPill label={t('notices:pinned')} tone="ink" /> : null}
            {n.status === 'DRAFT' ? <StatusPill label={t('notices:draft')} tone="neutral" /> : null}
          </View>
          <Text variant="h1" className="mt-4">
            {n.title}
          </Text>
          <Text variant="label" tone="secondary" className="mt-1">
            {[n.createdBy.displayName, mediumDate(n.publishedAt ?? n.createdAt)].join(' · ')}
          </Text>
          <Divider />
          <Text variant="body" className="leading-6">
            {n.body}
          </Text>
          {n.readCount !== null ? (
            <Text variant="label" tone="secondary" className="mt-5">
              {t('notices:readBy', { count: n.readCount })}
            </Text>
          ) : null}
        </Card>
      )}
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        options={options}
        onSelect={(a) => void run(a)}
      />
    </Screen>
  );
}
