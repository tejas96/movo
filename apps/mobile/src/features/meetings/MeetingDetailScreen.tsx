import type { MeetingUpdate } from '@movo/contracts';
import {
  Button,
  Card,
  Divider,
  Icon,
  IconSquare,
  Input,
  OptionSheet,
  Screen,
  SectionHeader,
  Sheet,
  Skeleton,
  Text,
  TitleBar,
  theme,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { dateTime, relative, whenRange } from '../../core/util/time';
import { type MeetingAction, useMeeting, useMeetingAction } from './api';
import { MeetingStatusPill } from './MeetingsScreen';

type MenuKey = 'edit' | MeetingAction;

export function MeetingDetailScreen() {
  const { t } = useTranslation(['meetings', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const { meetingId } = useRoute<RouteProp<RootStackParamList, 'MeetingDetail'>>().params;
  const meeting = useMeeting(societyId, meetingId);
  const action = useMeetingAction(societyId, meetingId);
  const canManage = useCan('meeting.manage');
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<MeetingAction | null>(null);
  const [note, setNote] = useState('');
  const m = meeting.data;
  const started = m ? new Date(m.startsAt).getTime() <= Date.now() : false;

  const options: { value: MenuKey; label: string }[] =
    m?.status === 'SCHEDULED'
      ? [
          { value: 'edit', label: t('common:actions.edit') },
          { value: 'note', label: t('meetings:actions.addNote') },
          ...(started
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
    try {
      await action.mutateAsync({ action: sheet, note: note.trim() || undefined });
      toast.show(
        sheet === 'note'
          ? t('meetings:actions.notePosted')
          : sheet === 'cancel'
            ? t('meetings:actions.cancelled')
            : t('meetings:actions.completed'),
      );
      setSheet(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
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
      <TitleBar
        title={t('meetings:title')}
        onBack={() => nav.goBack()}
        trailing={
          canManage && options.length > 0 ? (
            <IconSquare icon="more" variant="linear" onPress={() => setMenu(true)} />
          ) : undefined
        }
      />
      {meeting.isLoading || !m ? (
        <View className="mt-6 gap-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-48 rounded-xl" />
        </View>
      ) : (
        <>
          <Card className="mt-6">
            <View className="flex-row flex-wrap gap-2">
              <MeetingStatusPill status={m.status} />
            </View>
            <Text variant="h1" className={m.status === 'SCHEDULED' ? '' : 'mt-3'}>
              {m.title}
            </Text>
            <View className="mt-4 gap-2.5">
              <Fact icon="calendar" text={whenRange(m.startsAt, m.endsAt)} />
              {m.location ? <Fact icon="location" text={m.location} /> : null}
            </View>
            <Divider />
            <Text variant="h3" className="mb-2">
              {t('meetings:agenda')}
            </Text>
            <Text variant="body" tone={m.agenda ? 'primary' : 'secondary'} className="leading-6">
              {m.agenda ?? t('meetings:noAgenda')}
            </Text>
            <Text variant="label" tone="secondary" className="mt-5">
              {t('meetings:scheduledBy', { name: m.createdBy.displayName })}
            </Text>
          </Card>
          {m.updates.length > 0 ? (
            <>
              <SectionHeader title={t('meetings:updates')} />
              <Card tight className="gap-3 px-4 py-3">
                {m.updates.map((u) => (
                  <UpdateRow key={u.id} update={u} />
                ))}
              </Card>
            </>
          ) : null}
        </>
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
          <Input
            label={sheetCopy[sheet].label}
            placeholder={sheetCopy[sheet].hint || undefined}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
            white
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

function Fact({ icon, text }: { icon: 'calendar' | 'location'; text: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Icon name={icon} size={20} color={theme.color.text.secondary} />
      <Text variant="body" className="flex-1">
        {text}
      </Text>
    </View>
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
