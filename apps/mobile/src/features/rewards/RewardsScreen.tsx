import {
  Button,
  Card,
  EmptyState,
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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCan, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { relative } from '../../core/util/time';
import { useMembers } from '../directory/api';
import { useAdjustPoints, useLeaderboard, useMyPoints } from './api';

const REASON_ICON = { TASK: 'tasks', DUTY: 'duties', ADJUSTMENT: 'edit' } as const;

export function RewardsScreen() {
  const { t } = useTranslation(['rewards', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const canAdjust = useCan('reward.adjust');
  const board =
    (tenant.modules.find((m) => m.key === 'rewards')?.settings.leaderboard as string | undefined) ??
    'OFF';
  const showBoard = board !== 'OFF' || canAdjust;
  const mine = useMyPoints(societyId);
  const leaders = useLeaderboard(societyId, showBoard);
  const adjust = useAdjustPoints(societyId);
  const members = useMembers(societyId, '');
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(false);
  const [who, setWho] = useState<string | undefined>();
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const m = mine.data;
  const people = members.data?.pages.flatMap((p) => p.items) ?? [];
  const n = Number.parseInt(delta.replace('−', '-'), 10);

  const save = async () => {
    if (!who || !n || note.trim().length < 2) return;
    try {
      await adjust.mutateAsync({ membershipId: who, delta: n, note: note.trim() });
      toast.show(t('rewards:adjust.saved'));
      setOpen(false);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen refreshing={mine.isRefetching} onRefresh={() => void mine.refetch()}>
      <TitleBar
        title={t('rewards:title')}
        onBack={() => nav.goBack()}
        trailing={
          canAdjust ? (
            <IconSquare
              icon="edit"
              variant="linear"
              onPress={() => {
                setWho(undefined);
                setDelta('');
                setNote('');
                setOpen(true);
              }}
            />
          ) : undefined
        }
      />
      {mine.isLoading || !m ? (
        <Skeleton className="mt-6 h-40 rounded-xl" />
      ) : (
        <>
          <Card className="mt-6">
            <Text variant="label" tone="secondary">
              {t('rewards:thisYear', { fy: m.financialYear })}
            </Text>
            <Text variant="display">{m.points}</Text>
            <Text variant="label" tone="secondary">
              {[
                t('rewards:allTime', { count: m.allTimePoints }),
                m.rank ? t('rewards:rank', { rank: m.rank }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text variant="label" tone="tertiary" className="mt-3">
              {t('rewards:redeemLater')}
            </Text>
          </Card>

          {showBoard && leaders.data && leaders.data.rows.length > 0 ? (
            <>
              <SectionHeader title={t('rewards:leaderboard')} />
              <Card tight className="gap-1">
                {leaders.data.rows.map((r) => (
                  <Row
                    key={r.membershipId}
                    leading={
                      <View className="h-11 w-11 items-center justify-center rounded-sm bg-card-nested">
                        <Text variant="h3">{r.rank}</Text>
                      </View>
                    }
                    title={r.displayName}
                    subtitle={r.flat ?? undefined}
                    trailing={
                      <Text variant="bodyMedium" className="font-semibold">
                        {t('rewards:pts', { count: r.points })}
                      </Text>
                    }
                  />
                ))}
              </Card>
            </>
          ) : null}

          <SectionHeader title={t('rewards:history')} />
          {m.entries.length === 0 ? (
            <EmptyState icon="rewards" title={t('rewards:empty')} body={t('rewards:emptyBody')} />
          ) : (
            <Card tight className="gap-1">
              {m.entries.map((e) => (
                <Row
                  key={e.id}
                  icon={REASON_ICON[e.reason]}
                  title={e.label}
                  subtitle={`${t(`rewards:reason.${e.reason}`)} · ${relative(e.createdAt)}`}
                  trailing={
                    <Text
                      variant="bodyMedium"
                      tone={e.delta < 0 ? 'danger' : 'primary'}
                      className="font-semibold"
                    >
                      {e.delta > 0 ? `+${e.delta}` : `−${-e.delta}`}
                    </Text>
                  }
                />
              ))}
            </Card>
          )}
        </>
      )}
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('rewards:adjust.title')}
        footer={
          <Button
            label={t('common:actions.save')}
            loading={adjust.isPending}
            disabled={!who || !n || note.trim().length < 2}
            onPress={() => void save()}
          />
        }
      >
        <View className="gap-3">
          <SelectField
            white
            label={t('rewards:adjust.member')}
            placeholder={t('rewards:adjust.pickMember')}
            value={people.find((p) => p.membershipId === who)?.displayName}
            onPress={() => setPick(true)}
          />
          <Input
            white
            label={t('rewards:adjust.delta')}
            value={delta}
            onChangeText={setDelta}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Input
            white
            label={t('rewards:adjust.note')}
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />
        </View>
      </Sheet>
      <OptionSheet
        visible={pick}
        onClose={() => setPick(false)}
        title={t('rewards:adjust.member')}
        value={who}
        options={people.map((p) => ({
          value: p.membershipId,
          label: p.displayName,
          hint: p.flats[0] ? formatFlat(p.flats[0]) : undefined,
        }))}
        onSelect={setWho}
      />
    </Screen>
  );
}
