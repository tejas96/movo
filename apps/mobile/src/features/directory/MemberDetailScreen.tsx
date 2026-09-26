import {
  Avatar,
  Button,
  Card,
  CircleButton,
  Divider,
  OptionSheet,
  Pill,
  Row,
  Screen,
  Sheet,
  Skeleton,
  StatusPill,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useCan, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { useIssueResetCode, useMember, useRoles, useUpdateMember } from './api';

export function MemberDetailScreen() {
  const { t } = useTranslation(['society', 'common', 'manage']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const { membershipId } = useRoute<RouteProp<RootStackParamList, 'MemberDetail'>>().params;
  const member = useMember(societyId, membershipId);
  const roles = useRoles(societyId);
  const update = useUpdateMember(societyId, membershipId);
  const reset = useIssueResetCode(societyId, membershipId);
  const canManage = useCan('member.manage');
  const [roleOpen, setRoleOpen] = useState(false);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const m = member.data;
  const isMe = m?.membershipId === tenant.id;

  const setRole = async (roleId: string) => {
    try {
      await update.mutateAsync({ roleIds: [roleId] });
      toast.show(t('manage:member.updated'));
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };
  const setStatus = async (status: 'ACTIVE' | 'SUSPENDED' | 'LEFT') => {
    try {
      await update.mutateAsync({ status });
      toast.show(t('manage:member.updated'));
      if (status === 'LEFT') nav.goBack();
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };
  const issueCode = async () => {
    try {
      setCode(await reset.mutateAsync());
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen>
      <TitleBar title={t('society:directory.title')} onBack={() => nav.goBack()} />
      {!m ? (
        <View className="mt-6 gap-3">
          <Skeleton className="h-16 w-16 self-center rounded-full" />
          <Skeleton className="h-40 rounded-xl" />
        </View>
      ) : (
        <>
          <View className="mt-6 items-center">
            <Avatar name={m.displayName} uri={m.avatarUrl} size={64} tone="gray" />
            <Text variant="h2" className="mt-3">
              {m.displayName}
            </Text>
            <View className="mt-2 flex-row flex-wrap justify-center gap-2">
              {m.roles.map((r) => (
                <Pill
                  key={r.id}
                  label={r.name}
                  tone="gray"
                  size="sm"
                  icon={r.key === 'admin' ? 'verified' : undefined}
                />
              ))}
              {m.status !== 'ACTIVE' ? (
                <StatusPill label={t(`common:status.${m.status}`)} tone="neutral" />
              ) : null}
            </View>
          </View>
          <Card tight className="mt-6 gap-2">
            {m.flats.map((f) => (
              <Row
                key={f.id}
                icon="flat"
                title={formatFlat(f)}
                subtitle={t(`common:relation.${f.relation}`)}
              />
            ))}
            <Row
              icon="call"
              title={m.phone ?? t('society:directory.phoneHidden')}
              trailing={
                m.phone ? (
                  <CircleButton
                    icon="call"
                    onPress={() => void Linking.openURL(`tel:${m.phone}`)}
                  />
                ) : (
                  <View />
                )
              }
            />
            {m.email ? (
              <Row
                icon="mail"
                title={m.email}
                trailing={
                  <CircleButton
                    icon="mail"
                    variant="linear"
                    onPress={() => void Linking.openURL(`mailto:${m.email}`)}
                  />
                }
              />
            ) : null}
          </Card>
          {canManage && !isMe ? (
            <>
              <Divider className="my-6" />
              <View className="gap-3">
                <Button
                  label={t('manage:member.roles')}
                  variant="gray"
                  onPress={() => setRoleOpen(true)}
                />
                {m.status === 'ACTIVE' ? (
                  <Button
                    label={t('manage:member.suspend')}
                    variant="gray"
                    onPress={() => void setStatus('SUSPENDED')}
                    loading={update.isPending}
                  />
                ) : (
                  <Button
                    label={t('common:status.ACTIVE')}
                    variant="gray"
                    onPress={() => void setStatus('ACTIVE')}
                    loading={update.isPending}
                  />
                )}
                <Button
                  label={t('manage:member.resetCode')}
                  variant="gray"
                  onPress={() => void issueCode()}
                  loading={reset.isPending}
                />
                <Button
                  label={t('manage:member.remove')}
                  variant="danger"
                  onPress={() => void setStatus('LEFT')}
                />
              </View>
            </>
          ) : null}
        </>
      )}
      <OptionSheet
        visible={roleOpen}
        onClose={() => setRoleOpen(false)}
        title={t('manage:member.roles')}
        options={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
        value={m?.roles[0]?.id}
        onSelect={(id) => void setRole(id)}
      />
      <Sheet
        visible={Boolean(code)}
        onClose={() => setCode(null)}
        title={t('manage:member.resetCode')}
      >
        <Text variant="body" tone="secondary">
          {t('manage:member.resetCodeBody')}
        </Text>
        <View className="mt-4 items-center rounded-md bg-card-nested py-5">
          <Text variant="display" className="tracking-[4px]">
            {code?.code}
          </Text>
        </View>
        <Button label={t('common:actions.done')} onPress={() => setCode(null)} className="mt-4" />
      </Sheet>
    </Screen>
  );
}
