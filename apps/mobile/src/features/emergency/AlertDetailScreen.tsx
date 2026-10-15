import {
  Button,
  Card,
  IconSquare,
  Input,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { StatusPill } from '../../core/ui/StatusPill';
import { relative } from '../../core/util/date';
import { formatPhone } from '../../core/util/phone';
import { useAlert, useEmergencyContacts, useResolveAlert } from './api';
import { ContactRow } from './EmergencyScreen';
import { ALERT_ICON, ALERT_STATUS_TONE } from './shared';

export function AlertDetailScreen() {
  const { t } = useTranslation(['emergency', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const { alertId } = useRoute<RouteProp<RootStackParamList, 'AlertDetail'>>().params;
  const alert = useAlert(societyId, alertId);
  const contacts = useEmergencyContacts(societyId);
  const resolve = useResolveAlert(societyId, alertId);
  const [note, setNote] = useState('');
  const a = alert.data;
  const isActive = a?.status === 'ACTIVE';
  const raiserPhone = a?.raisedBy?.phone;
  // During an alert, the society's own contacts first, then the national emergency number.
  const quickContacts = [
    ...(contacts.data ?? []).filter((c) => !c.isPublicNumber).slice(0, 3),
    ...(contacts.data ?? []).filter((c) => c.isPublicNumber).slice(0, 1),
  ];

  const close = async (outcome: 'RESOLVED' | 'FALSE_ALARM') => {
    await withErrorToast(async () => {
      await resolve.mutateAsync({ outcome, note: note.trim() || null });
      toast.show(t('emergency:alert.closed'));
      void alert.refetch();
    });
  };

  return (
    <Screen refreshing={alert.isRefetching} onRefresh={() => void alert.refetch()}>
      <TitleBar title={t('emergency:title')} onBack={() => nav.goBack()} />
      {loadFailed(alert) ? (
        <QueryError query={alert} className="mt-6" />
      ) : !a ? (
        <View className="mt-6 gap-3">
          <Skeleton className="h-16 w-16 self-center" />
          <Skeleton className="h-32 rounded-xl" />
        </View>
      ) : (
        <>
          <View className="mt-6 items-center">
            <IconSquare icon={ALERT_ICON[a.type]} tone={isActive ? 'ink' : 'gray'} />
            <Text variant="h2" center className="mt-3">
              {t('emergency:alert.title', { type: t(`emergency:type.${a.type}`) })}
            </Text>
            <StatusPill
              value={a.status}
              tones={ALERT_STATUS_TONE}
              labels="emergency:status"
              dot={isActive}
              className="mt-2 self-center"
            />
            <Text variant="label" tone="secondary" center className="mt-2">
              {[a.flat ? formatFlat(a.flat) : t('emergency:societyPlace'), relative(a.createdAt)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

          <Card tight className="mt-6 gap-2">
            {a.raisedBy ? (
              <Row
                icon="user"
                title={t('emergency:alert.raisedBy', { name: a.raisedBy.displayName })}
                subtitle={raiserPhone ? formatPhone(raiserPhone) : undefined}
              />
            ) : null}
            {a.message ? <Row icon="chat" title={a.message} /> : null}
            {!isActive && a.resolvedBy ? (
              <Row
                icon="check"
                title={t('emergency:alert.closedBy', { name: a.resolvedBy.displayName })}
                subtitle={[a.resolutionNote, relative(a.resolvedAt)].filter(Boolean).join(' · ')}
              />
            ) : null}
          </Card>

          {a.canCallRaiser && raiserPhone ? (
            <Button
              className="mt-4"
              icon="call"
              label={t('emergency:alert.callRaiser', { name: a.raisedBy?.displayName ?? '' })}
              onPress={() => void Linking.openURL(`tel:${raiserPhone}`)}
            />
          ) : null}

          {isActive && quickContacts.length > 0 ? (
            <>
              <SectionHeader title={t('emergency:contacts')} />
              <Card tight className="gap-2">
                {quickContacts.map((c) => (
                  <ContactRow key={c.id} contact={c} />
                ))}
              </Card>
            </>
          ) : null}

          {a.canResolve ? (
            <>
              <SectionHeader title={t('emergency:alert.resolveTitle')} />
              <Input
                label={t('emergency:alert.note')}
                value={note}
                onChangeText={setNote}
                maxLength={280}
              />
              <View className="mt-3 flex-row gap-2">
                <Button
                  inline
                  className="flex-1"
                  label={t('emergency:alert.resolve')}
                  icon="check"
                  onPress={() => void close('RESOLVED')}
                  loading={resolve.isPending}
                />
                <Button
                  inline
                  className="flex-1"
                  label={t('emergency:alert.falseAlarm')}
                  variant="gray"
                  onPress={() => void close('FALSE_ALARM')}
                  disabled={resolve.isPending}
                />
              </View>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
