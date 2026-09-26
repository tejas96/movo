import { MAX_RSVP_GUESTS, type RsvpResponse } from '@movo/contracts';
import {
  Button,
  Card,
  CircleButton,
  Divider,
  Icon,
  IconSquare,
  Input,
  OptionSheet,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  Skeleton,
  StatusPill,
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
import { formatFlat, useCan, useSocietyId } from '../../core/tenant/hooks';
import { whenRange } from '../../core/util/time';
import { useCancelEvent, useEvent, useEventRsvps, useRsvp } from './api';

type MenuKey = 'edit' | 'cancel';

export function EventDetailScreen() {
  const { t } = useTranslation(['events', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const { eventId } = useRoute<RouteProp<RootStackParamList, 'EventDetail'>>().params;
  const event = useEvent(societyId, eventId);
  const canManage = useCan('event.manage');
  const rsvps = useEventRsvps(societyId, eventId, canManage);
  const rsvp = useRsvp(societyId, eventId);
  const cancel = useCancelEvent(societyId, eventId);
  const [menu, setMenu] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const e = event.data;
  const over = e
    ? new Date(e.endsAt ?? new Date(e.startsAt).getTime() + 2 * 3_600_000).getTime() < Date.now()
    : false;
  const canAnswer = Boolean(e && e.status === 'PUBLISHED' && e.rsvpEnabled && !over);

  const answer = async (response: RsvpResponse, guestsCount = 0) => {
    try {
      await rsvp.mutateAsync({ response, guestsCount });
      toast.show(t('events:rsvp.saved'));
    } catch (err) {
      toast.show(toMessage(err), 'error');
    }
  };

  const doCancel = async () => {
    try {
      await cancel.mutateAsync(reason.trim() || undefined);
      toast.show(t('events:actions.cancelled'));
      setCancelOpen(false);
    } catch (err) {
      toast.show(toMessage(err), 'error');
    }
  };

  const guests = e?.myRsvp?.response === 'GOING' ? e.myRsvp.guestsCount : 0;

  return (
    <Screen>
      <TitleBar
        title={t('events:title')}
        onBack={() => nav.goBack()}
        trailing={
          canManage && e?.status === 'PUBLISHED' ? (
            <IconSquare icon="more" variant="linear" onPress={() => setMenu(true)} />
          ) : undefined
        }
      />
      {event.isLoading || !e ? (
        <View className="mt-6 gap-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-48 rounded-xl" />
        </View>
      ) : (
        <>
          <Card className="mt-6">
            {e.status === 'CANCELLED' ? (
              <View className="mb-3 flex-row">
                <StatusPill label={t('events:status.CANCELLED')} tone="danger" />
              </View>
            ) : null}
            <Text variant="h1">{e.title}</Text>
            <View className="mt-4 gap-2.5">
              <Fact icon="calendar" text={whenRange(e.startsAt, e.endsAt)} />
              {e.location ? <Fact icon="location" text={e.location} /> : null}
              {e.rsvpEnabled && e.goingCount > 0 ? (
                <Fact icon="people" text={t('events:going', { count: e.goingCount })} />
              ) : null}
            </View>
            {e.description ? (
              <>
                <Divider />
                <Text variant="h3" className="mb-2">
                  {t('events:about')}
                </Text>
                <Text variant="body" className="leading-6">
                  {e.description}
                </Text>
              </>
            ) : null}
            <Text variant="label" tone="secondary" className="mt-5">
              {t('events:postedBy', { name: e.createdBy.displayName })}
            </Text>
          </Card>

          {e.rsvpEnabled && e.status === 'PUBLISHED' ? (
            <>
              <SectionHeader title={t('events:rsvp.question')} />
              {canAnswer ? (
                <Card tight className="gap-3 p-3">
                  <Segmented
                    value={e.myRsvp?.response ?? ('' as RsvpResponse)}
                    onChange={(r) => void answer(r, r === 'GOING' ? guests : 0)}
                    options={[
                      { value: 'GOING', label: t('events:rsvp.GOING') },
                      { value: 'MAYBE', label: t('events:rsvp.MAYBE') },
                      { value: 'NOT_GOING', label: t('events:rsvp.NOT_GOING') },
                    ]}
                  />
                  {e.myRsvp?.response === 'GOING' ? (
                    <View className="flex-row items-center justify-between px-2">
                      <Text variant="body">{t('events:rsvp.guests')}</Text>
                      <View className="flex-row items-center gap-3">
                        <CircleButton
                          icon="minus"
                          variant="linear"
                          tone="white"
                          size={40}
                          className={guests === 0 ? 'opacity-40' : undefined}
                          disabled={guests === 0 || rsvp.isPending}
                          onPress={() => void answer('GOING', guests - 1)}
                        />
                        <Text variant="h3" className="w-6 text-center">
                          {guests}
                        </Text>
                        <CircleButton
                          icon="add"
                          variant="linear"
                          tone="white"
                          size={40}
                          className={guests >= MAX_RSVP_GUESTS ? 'opacity-40' : undefined}
                          disabled={guests >= MAX_RSVP_GUESTS || rsvp.isPending}
                          onPress={() => void answer('GOING', guests + 1)}
                        />
                      </View>
                    </View>
                  ) : null}
                </Card>
              ) : (
                <Text variant="label" tone="secondary">
                  {e.myRsvp
                    ? t('events:rsvp.yours', { answer: t(`events:rsvp.${e.myRsvp.response}`) })
                    : t('events:rsvp.closed')}
                </Text>
              )}
            </>
          ) : null}

          {canManage && e.rsvpEnabled ? (
            <>
              <SectionHeader title={t('events:responses.title')} />
              <Text variant="label" tone="secondary" className="mb-2">
                {t('events:responses.summary', {
                  going: e.counts.going,
                  maybe: e.counts.maybe,
                  notGoing: e.counts.notGoing,
                })}
              </Text>
              {rsvps.data && rsvps.data.length > 0 ? (
                <Card tight className="gap-2">
                  {rsvps.data.map((r) => (
                    <Row
                      key={r.membershipId}
                      icon="user"
                      title={r.displayName}
                      subtitle={[
                        r.flats.map(formatFlat).join(', '),
                        r.guestsCount > 0
                          ? t('events:responses.guests', { count: r.guestsCount })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      trailing={
                        <StatusPill
                          label={t(`events:rsvp.${r.response}`)}
                          tone={
                            r.response === 'GOING'
                              ? 'success'
                              : r.response === 'MAYBE'
                                ? 'warning'
                                : 'neutral'
                          }
                        />
                      }
                    />
                  ))}
                </Card>
              ) : (
                <Text variant="label" tone="secondary">
                  {t('events:responses.empty')}
                </Text>
              )}
            </>
          ) : null}
        </>
      )}
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        options={[
          { value: 'edit' as MenuKey, label: t('common:actions.edit') },
          { value: 'cancel' as MenuKey, label: t('events:actions.cancel') },
        ]}
        onSelect={(k) => {
          if (k === 'edit') nav.navigate('EventEditor', { eventId });
          else {
            setReason('');
            setCancelOpen(true);
          }
        }}
      />
      <Sheet
        visible={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={t('events:actions.cancelTitle')}
        footer={
          <Button
            label={t('events:actions.cancel')}
            variant="danger"
            loading={cancel.isPending}
            onPress={() => void doCancel()}
          />
        }
      >
        <Input
          label={t('events:actions.cancelReason')}
          value={reason}
          onChangeText={setReason}
          maxLength={500}
          white
        />
      </Sheet>
    </Screen>
  );
}

function Fact({ icon, text }: { icon: 'calendar' | 'location' | 'people'; text: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Icon name={icon} size={20} color={theme.color.text.secondary} />
      <Text variant="body" className="flex-1">
        {text}
      </Text>
    </View>
  );
}
