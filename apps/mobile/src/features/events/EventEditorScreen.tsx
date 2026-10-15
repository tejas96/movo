import { eventsContract, type SocietyEvent } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Input,
  Screen,
  Text,
  TextArea,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import {
  type DurationKey,
  defaultStart,
  durationOf,
  endFor,
  WhenFields,
} from '../../core/calendar/shared';
import { bodyResolver, formMessage, usePrefill } from '../../core/forms/contract-form';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { useCreateEvent, useEvent, useUpdateEvent } from './api';

interface EventForm {
  title: string;
  description: string;
  location: string;
  start: Date;
  duration: DurationKey;
  rsvpEnabled: boolean;
}

function emptyForm(): EventForm {
  return {
    title: '',
    description: '',
    location: '',
    start: defaultStart(18),
    duration: 'h3',
    rsvpEnabled: true,
  };
}

function toForm(e: SocietyEvent): EventForm {
  return {
    title: e.title,
    description: e.description ?? '',
    location: e.location ?? '',
    start: new Date(e.startsAt),
    duration: durationOf(e.startsAt, e.endsAt),
    rsvpEnabled: e.rsvpEnabled,
  };
}

function toBody(v: EventForm) {
  return {
    title: v.title.trim(),
    description: v.description.trim() || null,
    location: v.location.trim() || null,
    startsAt: v.start.toISOString(),
    endsAt: endFor(v.start, v.duration),
    rsvpEnabled: v.rsvpEnabled,
  };
}

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
  const [timeError, setTimeError] = useState<string | undefined>();
  const form = useForm<EventForm>({
    resolver: bodyResolver(eventsContract.create.body, toBody),
    defaultValues: emptyForm(),
    reValidateMode: 'onSubmit',
  });
  usePrefill(form, eventId ? existing.data : undefined, toForm);
  const error = formMessage(form, t('common:validation.required'));
  const { start, duration, rsvpEnabled } = form.watch();

  const submit = form.handleSubmit(async (values) => {
    const moved =
      !existing.data || new Date(existing.data.startsAt).getTime() !== values.start.getTime();
    if ((!eventId || moved) && values.start.getTime() < Date.now()) {
      setTimeError(t('events:form.pastTime'));
      return;
    }
    const fields = toBody(values);
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
      form.setError('root.server', { message: toMessage(e) });
    }
  });

  const save = () => {
    setTimeError(undefined);
    void submit();
  };

  if (eventId && loadFailed(existing))
    return (
      <Screen>
        <TitleBar title={t('common:actions.edit')} onBack={() => nav.goBack()} />
        <QueryError query={existing} className="mt-10" />
      </Screen>
    );

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={eventId ? t('common:actions.edit') : t('events:new')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6 gap-3">
          <Controller
            control={form.control}
            name="title"
            render={({ field }) => (
              <Input
                label={t('events:form.title')}
                placeholder={t('events:form.titleHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={120}
              />
            )}
          />
          <WhenFields
            start={start}
            onStart={(d) => form.setValue('start', d)}
            duration={duration}
            onDuration={(d) => form.setValue('duration', d)}
            labels={{ startsAt: t('events:form.startsAt'), duration: t('events:form.duration') }}
            error={timeError}
          />
          <Controller
            control={form.control}
            name="location"
            render={({ field }) => (
              <Input
                label={t('events:form.location')}
                placeholder={t('events:form.locationHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={120}
              />
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <TextArea
                label={t('events:form.description')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={5000}
                minHeight={120}
              />
            )}
          />
          <View className="flex-row items-center justify-between rounded-md bg-card px-[18px] py-3">
            <Text variant="body">{t('events:form.rsvp')}</Text>
            <Toggle value={rsvpEnabled} onValueChange={(v) => form.setValue('rsvpEnabled', v)} />
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
            onPress={save}
            loading={create.isPending || update.isPending}
          />
        }
      />
    </>
  );
}
