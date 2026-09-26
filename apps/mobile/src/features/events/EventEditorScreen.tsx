import {
  BottomBar,
  Button,
  Input,
  Screen,
  Text,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { type DurationKey, defaultStart, durationOf, endFor, WhenFields } from '../calendar/shared';
import { useCreateEvent, useEvent, useUpdateEvent } from './api';

export function EventEditorScreen() {
  const { t } = useTranslation(['events', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const eventId = useRoute<RouteProp<RootStackParamList, 'EventEditor'>>().params?.eventId;
  const existing = useEvent(societyId, eventId ?? '');
  const create = useCreateEvent(societyId);
  const update = useUpdateEvent(societyId, eventId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState(() => defaultStart(18));
  const [duration, setDuration] = useState<DurationKey>('h3');
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | undefined>();

  useEffect(() => {
    const e = existing.data;
    if (!eventId || !e) return;
    setTitle(e.title);
    setDescription(e.description ?? '');
    setLocation(e.location ?? '');
    setStart(new Date(e.startsAt));
    setDuration(durationOf(e.startsAt, e.endsAt));
    setRsvpEnabled(e.rsvpEnabled);
  }, [eventId, existing.data]);

  const save = async () => {
    setError(null);
    setTimeError(undefined);
    if (title.trim().length < 2) {
      setError(t('common:validation.required'));
      return;
    }
    const moved = !existing.data || new Date(existing.data.startsAt).getTime() !== start.getTime();
    if ((!eventId || moved) && start.getTime() < Date.now()) {
      setTimeError(t('events:form.pastTime'));
      return;
    }
    const fields = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      startsAt: start.toISOString(),
      endsAt: endFor(start, duration),
      rsvpEnabled,
    };
    try {
      if (eventId) {
        await update.mutateAsync(fields);
        toast.show(t('events:form.saved'));
      } else {
        await create.mutateAsync({ ...fields, audience: { type: 'ALL' } });
        toast.show(t('events:form.published'));
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
          title={eventId ? t('common:actions.edit') : t('events:new')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6 gap-3">
          <Input
            label={t('events:form.title')}
            placeholder={t('events:form.titleHint')}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <WhenFields
            start={start}
            onStart={setStart}
            duration={duration}
            onDuration={setDuration}
            labels={{ startsAt: t('events:form.startsAt'), duration: t('events:form.duration') }}
            error={timeError}
          />
          <Input
            label={t('events:form.location')}
            placeholder={t('events:form.locationHint')}
            value={location}
            onChangeText={setLocation}
            maxLength={120}
          />
          <Input
            label={t('events:form.description')}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={5000}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <View className="flex-row items-center justify-between rounded-md bg-card px-[18px] py-3">
            <Text variant="body">{t('events:form.rsvp')}</Text>
            <Toggle value={rsvpEnabled} onValueChange={setRsvpEnabled} />
          </View>
          {!eventId ? (
            <Text variant="label" tone="secondary">
              {t('events:form.notifyHint')}
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
            label={eventId ? t('common:actions.save') : t('events:form.publish')}
            inline
            onPress={() => void save()}
            loading={create.isPending || update.isPending}
          />
        }
      />
    </>
  );
}
