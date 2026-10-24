import type { MeetingUpdate } from '@movo/contracts';
import {
  Button,
  Glass,
  IconSquare,
  OptionSheet,
  Rise,
  Screen,
  SectionLabel,
  Sheet,
  Skeleton,
  Text,
  TextArea,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { MeetingStatusPill } from '../../core/calendar/MeetingStatusPill';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { DetailHero, HeroPill } from '../../core/ui/DetailHero';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { dateTime, relative, whenRange } from '../../core/util/date';
import { type MeetingAction, useMeeting, useMeetingAction } from './api';

type MenuKey = 'edit' | MeetingAction;

export function MeetingDetailScreen() {
  const { t } = useTranslation(['meetings', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const { meetingId } = useRoute<RouteProp<RootStackParamList, 'MeetingDetail'>>().params;
  const meeting = useMeeting(societyId, meetingId);
  const action = useMeetingAction(societyId, meetingId);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<MeetingAction | null>(null);
  const [note, setNote] = useState('');
  const m = meeting.data;

  const options: { value: MenuKey; label: string }[] = m?.canManage
    ? [
        { value: 'edit', label: t('common:actions.edit') },
        { value: 'note', label: t('meetings:actions.addNote') },
        ...(m.canComplete
          ? [{ value: 'complete' as const, label: t('meetings:actions.complete') }]
          : []),
        { value: 'cancel', label: t('meetings:actions.cancel') },
      ]
    : [];

  const choose = (key: MenuKey) => {
    if (key === 'edit') nav.navigate('MeetingEditor', { meetingId });
    else {
      setNote('');
      setSheet(key);
    }
  };

  const submit = async () => {
    if (!sheet) return;
    if (sheet === 'note' && note.trim().length === 0) return;
    await withErrorToast(async () => {
      await action.mutateAsync({ action: sheet, note: note.trim() || undefined });
      toast.show(
        sheet === 'note'
          ? t('meetings:actions.notePosted')
          : sheet === 'cancel'
            ? t('meetings:actions.cancelled')
            : t('meetings:actions.completed'),
      );
      setSheet(null);
    });
  };

  const sheetCopy = {
    note: {
      title: t('meetings:actions.addNote'),
      label: t('meetings:actions.note'),
      hint: t('meetings:actions.noteHint'),
      cta: t('meetings:actions.addNote'),
    },
    cancel: {
      title: t('meetings:actions.cancelTitle'),
      label: t('meetings:actions.cancelReason'),
      hint: '',
      cta: t('meetings:actions.cancel'),
    },
    complete: {
      title: t('meetings:actions.complete'),
      label: t('meetings:actions.completeNote'),
      hint: '',
      cta: t('meetings:actions.complete'),
    },
  } as const;

  return (
    <Screen>
      {loadFailed(meeting) ? (
        <QueryError query={meeting} className="mt-6" />
      ) : meeting.isLoading || !m ? (
        <View className="gap-3">
          <Skeleton className="h-[312px] rounded-[40px]" />
          <Skeleton className="h-48 rounded-[30px]" />
        </View>
      ) : (
        <View style={styles.page}>
          <Rise>
            <DetailHero
              art="meeting"
              onBack={() => nav.goBack()}
              trailing={
                options.length > 0 ? (
                  <IconSquare
                    icon="more"
                    variant="linear"
                    diameter={46}
                    onPress={() => setMenu(true)}
                    accessibilityLabel={t('common:actions.more')}
                  />
                ) : undefined
              }
              icon={{ name: 'meetings', motion: 'bob' }}
              pills={
                <>
                  <HeroPill label={t('meetings:scheduledBy', { name: m.createdBy.displayName })} />
                  <MeetingStatusPill status={m.status} />
                </>
              }
              title={m.title}
              meta={[whenRange(m.startsAt, m.endsAt), m.location].filter(Boolean).join('  |  ')}
            />
          </Rise>
          <Rise delay={80}>
            <Glass radius={30} style={styles.card}>
              <SectionLabel className="px-0 pt-0 pb-2">{t('meetings:agenda')}</SectionLabel>
              <Text variant="body" tone={m.agenda ? 'primary' : 'secondary'} style={styles.text}>
                {m.agenda ?? t('meetings:noAgenda')}
              </Text>
            </Glass>
          </Rise>
          {m.updates.length > 0 ? (
            <Rise delay={120}>
              <Glass radius={28} style={styles.card}>
                <SectionLabel className="px-0 pt-0 pb-2">{t('meetings:updates')}</SectionLabel>
                <View className="gap-3">
                  {m.updates.map((u) => (
                    <UpdateRow key={u.id} update={u} />
                  ))}
                </View>
              </Glass>
            </Rise>
          ) : null}
        </View>
      )}
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        options={options}
        onSelect={choose}
      />
      <Sheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet ? sheetCopy[sheet].title : undefined}
        footer={
          sheet ? (
            <Button
              label={sheetCopy[sheet].cta}
              variant={sheet === 'cancel' ? 'danger' : 'ink'}
              loading={action.isPending}
              onPress={() => void submit()}
            />
          ) : undefined
        }
      >
        {sheet ? (
          <TextArea
            label={sheetCopy[sheet].label}
            placeholder={sheetCopy[sheet].hint || undefined}
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            white
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

function UpdateRow({ update }: { update: MeetingUpdate }) {
  const { t } = useTranslation('meetings');
  const head =
    update.kind === 'RESCHEDULED'
      ? t('update.RESCHEDULED', { from: dateTime(update.previousStartsAt) })
      : t(`update.${update.kind}`);
  return (
    <View>
      <Text variant="bodyMedium">{head}</Text>
      {update.body ? (
        <Text variant="body" className="mt-0.5">
          {update.body}
        </Text>
      ) : null}
      <Text variant="label" tone="secondary" className="mt-0.5">
        {[update.createdBy.displayName, relative(update.createdAt)].join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14, marginHorizontal: -4 },
  card: { padding: 18 },
  text: { lineHeight: 24 },
});
