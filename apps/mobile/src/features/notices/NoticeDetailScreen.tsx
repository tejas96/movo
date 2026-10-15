import type { NoticeCategory } from '@movo/contracts';
import {
  IconSquare,
  OptionSheet,
  PhotoHeader,
  type PhotoName,
  photos,
  Screen,
  Skeleton,
  StatusPill as SoftPill,
  Text,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { StatusPill } from '../../core/ui/StatusPill';
import { mediumDate } from '../../core/util/date';
import { useNotice, useNoticeAction } from './api';
import { PRIORITY_TONE } from './NoticesScreen';

type Action = 'edit' | 'pin' | 'unpin' | 'publish' | 'archive';

/** The photo at the top follows the category, so a water notice does not look like a party. */
const CATEGORY_PHOTO: Record<NoticeCategory, PhotoName> = {
  GENERAL: 'notices',
  WATER: 'notices',
  ELECTRICITY: 'services',
  MAINTENANCE: 'tasks',
  SECURITY: 'duties',
  EVENT: 'events',
  FINANCE: 'money',
  EMERGENCY: 'emergency',
  OTHER: 'notices',
};

export function NoticeDetailScreen() {
  const { t } = useTranslation(['notices', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const { noticeId } = useRoute<RouteProp<RootStackParamList, 'NoticeDetail'>>().params;
  const notice = useNotice(societyId, noticeId);
  const action = useNoticeAction(societyId, noticeId);
  const [menu, setMenu] = useState(false);
  const n = notice.data;
  const canEdit = n?.canEdit === true;

  const run = async (a: Action) => {
    if (a === 'edit') {
      nav.navigate('NoticeEditor', { noticeId });
      return;
    }
    await withErrorToast(async () => {
      await action.mutateAsync(a);
      if (a === 'archive') {
        toast.show(t('notices:archived'));
        nav.goBack();
      } else if (a === 'publish') toast.show(t('notices:form.published'));
    });
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
      <PhotoHeader
        source={photos[n ? CATEGORY_PHOTO[n.category] : 'notices']}
        height={220}
        onBack={() => nav.goBack()}
        trailing={
          canEdit ? (
            <IconSquare icon="more" variant="linear" tone="white" onPress={() => setMenu(true)} />
          ) : undefined
        }
        pills={n ? [{ icon: 'notices', label: t(`notices:category.${n.category}`) }] : undefined}
      />
      {loadFailed(notice) ? (
        <QueryError query={notice} className="mt-6" />
      ) : notice.isLoading || !n ? (
        <View className="mt-6 gap-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-48 rounded-xl" />
        </View>
      ) : (
        <View className="mt-5">
          {n.priority !== 'NORMAL' || n.isPinned || n.status === 'DRAFT' ? (
            <View className="mb-3 flex-row flex-wrap gap-2">
              {n.priority !== 'NORMAL' ? (
                <StatusPill
                  value={n.priority}
                  tones={PRIORITY_TONE}
                  labels="notices:priority"
                  dot
                />
              ) : null}
              {n.isPinned ? <SoftPill label={t('notices:pinned')} tone="ink" /> : null}
              {n.status === 'DRAFT' ? <SoftPill label={t('notices:draft')} tone="neutral" /> : null}
            </View>
          ) : null}
          <Text variant="h1">{n.title}</Text>
          <Text variant="label" tone="secondary" className="mt-1.5">
            {[n.createdBy.displayName, mediumDate(n.publishedAt ?? n.createdAt)].join(' · ')}
          </Text>
          <Text variant="body" className="mt-5 leading-6">
            {n.body}
          </Text>
          {n.readCount !== null ? (
            <Text variant="label" tone="tertiary" className="mt-6">
              {t('notices:readBy', { count: n.readCount })}
            </Text>
          ) : null}
        </View>
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
