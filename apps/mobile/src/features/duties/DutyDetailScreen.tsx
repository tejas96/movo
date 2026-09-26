import type { DutyAssignment } from '@movo/contracts';
import {
  Button,
  Card,
  IconSquare,
  Input,
  OptionSheet,
  Row,
  Screen,
  SectionHeader,
  SelectField,
  Sheet,
  Skeleton,
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
import { formatFlat, useCan, useSocietyId } from '../../core/tenant/hooks';
import { day } from '../../core/util/money';
import { useMembers } from '../directory/api';
import { useFlats } from '../manage/api';
import { useDuty, useDutyAction } from './api';
import { cadenceLabel, OrderedPickSheet, TurnPill, turnLine } from './shared';

type OverrideAction = 'SKIP' | 'REASSIGN' | 'COMPLETE';
type MenuKey = 'order' | 'pause' | 'resume' | 'end';

export function DutyDetailScreen() {
  const { t } = useTranslation(['duties', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const { dutyId } = useRoute<RouteProp<RootStackParamList, 'DutyDetail'>>().params;
  const duty = useDuty(societyId, dutyId);
  const action = useDutyAction(societyId, dutyId);
  const canManage = useCan('duty.manage');
  const canOverride = useCan('duty.override');
  const [menu, setMenu] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [turn, setTurn] = useState<DutyAssignment | null>(null);
  const [overrideAction, setOverrideAction] = useState<OverrideAction>('SKIP');
  const [pickOpen, setPickOpen] = useState(false);
  const [who, setWho] = useState<string | undefined>();
  const [reason, setReason] = useState('');
  const [endOpen, setEndOpen] = useState(false);
  const d = duty.data;
  // The card turns black only while it is my turn and not done yet.
  const myTurnNow = d?.current?.mine === true && d.current.status === 'ACTIVE';
  const flats = useFlats(societyId);
  const members = useMembers(societyId, '');

  const candidates =
    d?.participantKind === 'FLAT'
      ? (flats.data ?? []).map((f) => ({ id: f.id, label: formatFlat(f) }))
      : (members.data?.pages.flatMap((p) => p.items) ?? []).map((m) => ({
          id: m.membershipId,
          label: m.displayName,
          hint: m.flats[0] ? formatFlat(m.flats[0]) : undefined,
        }));

  const run = async (a: Parameters<typeof action.mutateAsync>[0], ok: string) => {
    try {
      await action.mutateAsync(a);
      toast.show(ok);
      return true;
    } catch (e) {
      toast.show(toMessage(e), 'error');
      return false;
    }
  };

  const openTurn = (a: DutyAssignment) => {
    if (!canOverride) return;
    setTurn(a);
    setOverrideAction(a.status === 'MISSED' ? 'COMPLETE' : 'SKIP');
    setWho(undefined);
    setReason('');
  };

  const menuOptions: { value: MenuKey; label: string }[] = d
    ? [
        { value: 'order', label: t('duties:manage.editOrder') },
        d.status === 'ACTIVE'
          ? { value: 'pause', label: t('duties:manage.pause') }
          : { value: 'resume', label: t('duties:manage.resume') },
        { value: 'end', label: t('duties:manage.end') },
      ]
    : [];

  const turnActions: { value: OverrideAction; label: string }[] = turn
    ? turn.status === 'MISSED'
      ? [{ value: 'COMPLETE', label: t('duties:override.complete') }]
      : [
          { value: 'SKIP', label: t('duties:override.skip') },
          { value: 'REASSIGN', label: t('duties:override.reassign') },
          ...(turn.status === 'ACTIVE'
            ? [{ value: 'COMPLETE' as const, label: t('duties:override.complete') }]
            : []),
        ]
    : [];

  return (
    <Screen refreshing={duty.isRefetching} onRefresh={() => void duty.refetch()}>
      <TitleBar
        title={t('duties:title')}
        onBack={() => nav.goBack()}
        trailing={
          canManage && d && d.status !== 'ENDED' ? (
            <IconSquare icon="more" variant="linear" onPress={() => setMenu(true)} />
          ) : undefined
        }
      />
      {duty.isLoading || !d ? (
        <Skeleton className="mt-6 h-48 rounded-xl" />
      ) : (
        <>
          <Card className={myTurnNow ? 'mt-6 bg-ink' : 'mt-6'}>
            <Text variant="h2" tone={myTurnNow ? 'inverse' : 'primary'}>
              {d.title}
            </Text>
            <Text variant="label" tone={myTurnNow ? 'inverse' : 'secondary'}>
              {[
                cadenceLabel(t as never, d),
                d.points ? t('duties:pointsEach', { count: d.points }) : null,
                d.status !== 'ACTIVE' ? t(`duties:dutyStatus.${d.status}`) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {d.description ? (
              <Text variant="body" tone={myTurnNow ? 'inverse' : 'primary'} className="mt-3">
                {d.description}
              </Text>
            ) : null}
            <Text variant="bodyMedium" tone={myTurnNow ? 'inverse' : 'primary'} className="mt-4">
              {d.current ? turnLine(t as never, d.current) : t('duties:noCurrent')}
            </Text>
            {d.current?.status === 'ACTIVE' && (d.current.mine || canOverride) ? (
              <>
                {d.current.mine && d.requiresConfirmation ? (
                  <Text variant="label" tone="inverse" className="mt-1">
                    {t('duties:confirmHint')}
                  </Text>
                ) : null}
                <Button
                  className="mt-4"
                  variant={myTurnNow ? 'white' : 'ink'}
                  icon="check"
                  label={t('duties:markDone')}
                  loading={action.isPending}
                  onPress={() =>
                    d.current &&
                    void run({ kind: 'confirm', assignmentId: d.current.id }, t('duties:marked'))
                  }
                />
              </>
            ) : null}
          </Card>

          <SectionHeader title={t('duties:order')} />
          <Card tight className="gap-2">
            {d.participants.map((p, i) => (
              <Row
                key={p.id}
                icon={d.participantKind === 'FLAT' ? 'flat' : 'user'}
                title={`${i + 1}. ${p.label}`}
              />
            ))}
          </Card>

          {d.upcoming.length > 0 ? (
            <>
              <SectionHeader title={t('duties:upcoming')} />
              <Card tight className="gap-2">
                {[...(d.current ? [d.current] : []), ...d.upcoming].map((a) => (
                  <TurnRow
                    key={a.id}
                    turn={a}
                    onPress={canOverride ? () => openTurn(a) : undefined}
                  />
                ))}
              </Card>
            </>
          ) : null}

          {d.history.length > 0 ? (
            <>
              <SectionHeader title={t('duties:history')} />
              <Card tight className="gap-2">
                {d.history.map((a) => (
                  <TurnRow
                    key={a.id}
                    turn={a}
                    onPress={canOverride && a.status === 'MISSED' ? () => openTurn(a) : undefined}
                  />
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}

      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        options={menuOptions}
        onSelect={(k) => {
          if (k === 'order') {
            setOrder(d?.participants.map((p) => p.id) ?? []);
            setOrderOpen(true);
          } else if (k === 'pause')
            void run({ kind: 'status', status: 'PAUSED' }, t('duties:manage.paused'));
          else if (k === 'resume')
            void run({ kind: 'status', status: 'ACTIVE' }, t('duties:manage.resumed'));
          else setEndOpen(true);
        }}
      />
      <OrderedPickSheet
        visible={orderOpen}
        onClose={() => {
          setOrderOpen(false);
          if (order.length > 0 && d && order.join() !== d.participants.map((p) => p.id).join())
            void run({ kind: 'participants', participantIds: order }, t('duties:form.saved'));
        }}
        title={t('duties:manage.editOrder')}
        items={candidates}
        value={order}
        onChange={setOrder}
      />
      <Sheet
        visible={endOpen}
        onClose={() => setEndOpen(false)}
        title={t('duties:manage.endTitle')}
        footer={
          <Button
            variant="danger"
            label={t('duties:manage.end')}
            loading={action.isPending}
            onPress={() =>
              void run({ kind: 'status', status: 'ENDED' }, t('duties:manage.ended')).then(
                (ok) => ok && setEndOpen(false),
              )
            }
          />
        }
      >
        <Text variant="body" tone="secondary">
          {d?.title ?? ''}
        </Text>
      </Sheet>
      <Sheet
        visible={turn !== null}
        onClose={() => setTurn(null)}
        title={t('duties:override.title')}
        footer={
          <Button
            label={t('common:actions.save')}
            loading={action.isPending}
            disabled={reason.trim().length < 2 || (overrideAction === 'REASSIGN' && !who)}
            onPress={() =>
              turn &&
              void run(
                {
                  kind: 'override',
                  assignmentId: turn.id,
                  body: {
                    action: overrideAction,
                    reason: reason.trim(),
                    ...(overrideAction === 'REASSIGN' && who ? { participantId: who } : {}),
                  },
                },
                t('duties:override.saved'),
              ).then((ok) => ok && setTurn(null))
            }
          />
        }
      >
        <View className="gap-3">
          {turn ? (
            <Text variant="label" tone="secondary">
              {`${turn.participant.label} · ${day(turn.periodStart, 'short')} – ${day(turn.periodEnd, 'short')}`}
            </Text>
          ) : null}
          {turnActions.length > 1 ? (
            <View className="gap-2">
              {turnActions.map((o) => (
                <Button
                  key={o.value}
                  label={o.label}
                  variant={overrideAction === o.value ? 'ink' : 'white'}
                  size="sm"
                  onPress={() => setOverrideAction(o.value)}
                />
              ))}
            </View>
          ) : null}
          {overrideAction === 'REASSIGN' ? (
            <SelectField
              white
              label={t('duties:override.pick')}
              value={d?.participants.find((p) => p.id === who)?.label}
              onPress={() => setPickOpen(true)}
            />
          ) : null}
          <Input
            white
            label={t('duties:override.reason')}
            value={reason}
            onChangeText={setReason}
            maxLength={300}
          />
        </View>
      </Sheet>
      <OptionSheet
        visible={pickOpen}
        onClose={() => setPickOpen(false)}
        title={t('duties:override.pick')}
        value={who}
        options={(d?.participants ?? []).map((p) => ({ value: p.id, label: p.label }))}
        onSelect={setWho}
      />
    </Screen>
  );
}

function TurnRow({ turn, onPress }: { turn: DutyAssignment; onPress?: () => void }) {
  const { t } = useTranslation('duties');
  return (
    <Row
      icon={turn.mine ? 'star' : 'calendar'}
      title={turn.mine ? t('yourTurn') : turn.participant.label}
      subtitle={[
        `${day(turn.periodStart, 'short')} – ${day(turn.periodEnd, 'short')}`,
        turn.overrideNote,
      ]
        .filter(Boolean)
        .join(' · ')}
      trailing={<TurnPill status={turn.status} />}
      onPress={onPress}
    />
  );
}
