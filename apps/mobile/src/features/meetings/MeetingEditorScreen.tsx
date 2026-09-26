import { BottomBar, Button, Input, Screen, Text, TitleBar, useToast } from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { type DurationKey, defaultStart, durationOf, endFor, WhenFields } from '../calendar/shared';
import { useCreateMeeting, useMeeting, useUpdateMeeting } from './api';

export function MeetingEditorScreen() {
  const { t } = useTranslation(['meetings', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const meetingId = useRoute<RouteProp<RootStackParamList, 'MeetingEditor'>>().params?.meetingId;
  const existing = useMeeting(societyId, meetingId ?? '');
  const create = useCreateMeeting(societyId);
  const update = useUpdateMeeting(societyId, meetingId ?? '');
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState(() => defaultStart(19));
  const [duration, setDuration] = useState<DurationKey>('h1');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | undefined>();

  useEffect(() => {
    const m = existing.data;
    if (!meetingId || !m) return;
    setTitle(m.title);
    setAgenda(m.agenda ?? '');
    setLocation(m.location ?? '');
    setStart(new Date(m.startsAt));
    setDuration(durationOf(m.startsAt, m.endsAt));
  }, [meetingId, existing.data]);

  const moved = Boolean(
    meetingId && existing.data && new Date(existing.data.startsAt).getTime() !== start.getTime(),
  );

  const save = async () => {
    setError(null);
    setTimeError(undefined);
    if (title.trim().length < 2) {
      setError(t('common:validation.required'));
      return;
    }
    if ((!meetingId || moved) && start.getTime() < Date.now()) {
      setTimeError(t('meetings:form.pastTime'));
      return;
    }
    const fields = {
      title: title.trim(),
      agenda: agenda.trim() || null,
      location: location.trim() || null,
      startsAt: start.toISOString(),
      endsAt: endFor(start, duration),
    };
    try {
      if (meetingId) {
        await update.mutateAsync({
          ...fields,
          ...(moved && note.trim() ? { note: note.trim() } : {}),
        });
        toast.show(t('meetings:form.saved'));
      } else {
        await create.mutateAsync({ ...fields, audience: { type: 'ALL' } });
        toast.show(t('meetings:form.scheduled'));
      }
      nav.goBack();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={meetingId ? t('common:actions.edit') : t('meetings:new')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6 gap-3">
          <Input
            label={t('meetings:form.title')}
            placeholder={t('meetings:form.titleHint')}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <WhenFields
            start={start}
            onStart={setStart}
            duration={duration}
            onDuration={setDuration}
            labels={{
              startsAt: t('meetings:form.startsAt'),
              duration: t('meetings:form.duration'),
            }}
            error={timeError}
          />
          <Input
            label={t('meetings:form.location')}
            placeholder={t('meetings:form.locationHint')}
            value={location}
            onChangeText={setLocation}
            maxLength={120}
          />
          <Input
            label={t('meetings:form.agenda')}
            value={agenda}
            onChangeText={setAgenda}
            multiline
            maxLength={5000}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          {moved ? (
            <Input
              label={t('meetings:form.rescheduleNote')}
              value={note}
              onChangeText={setNote}
              maxLength={1000}
            />
          ) : null}
          {!meetingId ? (
            <Text variant="label" tone="secondary">
              {t('meetings:form.notifyHint')}
            </Text>
          ) : null}
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
      </Screen>
      <BottomBar
        action={
          <Button
            label={meetingId ? t('common:actions.save') : t('meetings:form.schedule')}
            inline
            onPress={() => void save()}
            loading={create.isPending || update.isPending}
          />
        }
      />
    </>
  );
}
