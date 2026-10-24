import {
  Glass,
  IconSquare,
  OptionSheet,
  Rise,
  Screen,
  Skeleton,
  StatusPill as SoftPill,
  Text,
  useToast,
  WaterDrop,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { DetailHero, HeroPill } from '../../core/ui/DetailHero';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { StatusPill } from '../../core/ui/StatusPill';
import { mediumDate } from '../../core/util/date';
import { useNotice, useNoticeAction } from './api';
import { CATEGORY_LOOK } from './look';
import { PRIORITY_TONE } from './NoticesScreen';

type Action = 'edit' | 'pin' | 'unpin' | 'publish' | 'archive';

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

  const look = n ? CATEGORY_LOOK[n.category] : CATEGORY_LOOK.GENERAL;
  const menuButton = canEdit ? (
    <IconSquare
      icon="more"
      variant="linear"
      diameter={46}
      onPress={() => setMenu(true)}
      accessibilityLabel={t('common:actions.more')}
    />
  ) : undefined;

  return (
    <Screen>
      {loadFailed(notice) ? (
        <QueryError query={notice} className="mt-6" />
      ) : notice.isLoading || !n ? (
        <View className="gap-3">
          <Skeleton className="h-[312px] rounded-[40px]" />
          <Skeleton className="h-48 rounded-[30px]" />
        </View>
      ) : (
        <View style={styles.page}>
          <Rise>
            <DetailHero
              art={n.category === 'WATER' ? 'water' : look.tile}
              onBack={() => nav.goBack()}
              trailing={menuButton}
              drawing={n.category === 'WATER' ? <WaterDrop /> : undefined}
              icon={{ name: look.icon, motion: look.motion }}
              pills={
                <>
                  <HeroPill label={t(`notices:category.${n.category}`)} />
                  {n.priority !== 'NORMAL' ? (
                    <StatusPill
                      value={n.priority}
                      tones={PRIORITY_TONE}
                      labels="notices:priority"
                      dot
                    />
                  ) : null}
                  {n.isPinned ? <SoftPill label={t('notices:pinned')} tone="ink" /> : null}
                  {n.status === 'DRAFT' ? (
                    <SoftPill label={t('notices:draft')} tone="neutral" />
                  ) : null}
                </>
              }
              title={n.title}
              meta={[n.createdBy.displayName, mediumDate(n.publishedAt ?? n.createdAt)].join(' · ')}
            />
          </Rise>
          <Rise delay={80}>
            <Glass radius={30} style={styles.body}>
              <Text variant="body" style={styles.text}>
                {n.body}
              </Text>
              {n.readCount !== null ? (
                <Text variant="label" tone="secondary" className="mt-4">
                  {t('notices:readBy', { count: n.readCount })}
                </Text>
              ) : null}
            </Glass>
          </Rise>
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

const styles = StyleSheet.create({
  page: { gap: 14, marginHorizontal: -4 },
  body: { padding: 18 },
  text: { lineHeight: 24 },
});
