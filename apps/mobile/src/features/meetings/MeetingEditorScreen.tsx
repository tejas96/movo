import { type Meeting, meetingsContract } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Card,
  Input,
  Screen,
  Text,
  TextArea,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
import { useCreateMeeting, useMeeting, useUpdateMeeting } from './api';

interface MeetingForm {
  title: string;
  agenda: string;
  location: string;
  start: Date;
  duration: DurationKey;
  /** Sent only on update, when the start time moved. */
  note: string;
}

function emptyForm(): MeetingForm {
  return {
    title: '',
    agenda: '',
    location: '',
    start: defaultStart(19),
    duration: 'h1',
    note: '',
  };
}

function toForm(m: Meeting): MeetingForm {
  return {
    title: m.title,
    agenda: m.agenda ?? '',
    location: m.location ?? '',
    start: new Date(m.startsAt),
    duration: durationOf(m.startsAt, m.endsAt),
    note: '',
  };
}

function toBody(v: MeetingForm) {
  return {
    title: v.title.trim(),
    agenda: v.agenda.trim() || null,
    location: v.location.trim() || null,
    startsAt: v.start.toISOString(),
    endsAt: endFor(v.start, v.duration),
  };
}

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
  const [timeError, setTimeError] = useState<string | undefined>();
  const form = useForm<MeetingForm>({
    resolver: bodyResolver(meetingsContract.create.body, toBody),
    defaultValues: emptyForm(),
    reValidateMode: 'onSubmit',
  });
  usePrefill(form, meetingId ? existing.data : undefined, toForm);
  const error = formMessage(form, t('common:validation.required'));
  const { start, duration } = form.watch();

  const isMoved = (at: Date) =>
    Boolean(
      meetingId && existing.data && new Date(existing.data.startsAt).getTime() !== at.getTime(),
    );
  const moved = isMoved(start);

  const submit = form.handleSubmit(async (values) => {
    const movedNow = isMoved(values.start);
    if ((!meetingId || movedNow) && values.start.getTime() < Date.now()) {
      setTimeError(t('meetings:form.pastTime'));
      return;
    }
    const fields = toBody(values);
    try {
      if (meetingId) {
        await update.mutateAsync({
          ...fields,
          ...(movedNow && values.note.trim() ? { note: values.note.trim() } : {}),
        });
        toast.show(t('meetings:form.saved'));
      } else {
        await create.mutateAsync({ ...fields, audience: { type: 'ALL' } });
        toast.show(t('meetings:form.scheduled'));
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

  if (meetingId && loadFailed(existing))
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
          title={meetingId ? t('common:actions.edit') : t('meetings:new')}
          onBack={() => nav.goBack()}
        />
        <Card className="mt-5 gap-3.5">
          <Controller
            control={form.control}
            name="title"
            render={({ field }) => (
              <Input
                label={t('meetings:form.title')}
                placeholder={t('meetings:form.titleHint')}
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
            labels={{
              startsAt: t('meetings:form.startsAt'),
              duration: t('meetings:form.duration'),
            }}
            error={timeError}
          />
          <Controller
            control={form.control}
            name="location"
            render={({ field }) => (
              <Input
                label={t('meetings:form.location')}
                placeholder={t('meetings:form.locationHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={120}
              />
            )}
          />
          <Controller
            control={form.control}
            name="agenda"
            render={({ field }) => (
              <TextArea
                label={t('meetings:form.agenda')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={5000}
                minHeight={120}
              />
            )}
          />
          {moved ? (
            <Controller
              control={form.control}
              name="note"
              render={({ field }) => (
                <Input
                  label={t('meetings:form.rescheduleNote')}
                  value={field.value}
                  onChangeText={field.onChange}
                  maxLength={1000}
                />
              )}
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
        </Card>
      </Screen>
      <BottomBar
        action={
          <Button
            label={meetingId ? t('common:actions.save') : t('meetings:form.schedule')}
            inline
            onPress={save}
            loading={create.isPending || update.isPending}
          />
        }
      />
    </>
  );
}
