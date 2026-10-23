import {
  Avatar,
  Button,
  Card,
  Chip,
  CircleButton,
  Divider,
  Pill,
  photos,
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
import { Alert, Image, Linking, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useCan, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { formatRegistration, slotIcon } from '../parking/shared';
import { useIssueResetCode, useMember, useRoles, useUpdateMember } from './api';
import { MemberFlatsSheet } from './MemberFlatsSheet';

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
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
  const [flatsOpen, setFlatsOpen] = useState(false);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const m = member.data;
  const isMe = m?.membershipId === tenant.id;

  const openRoles = () => {
    setRoleIds(new Set(m?.roles.map((r) => r.id)));
    setRoleOpen(true);
  };
  const flipRole = (id: string) =>
    setRoleIds((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  const saveRoles = async () => {
    try {
      await update.mutateAsync({ roleIds: [...roleIds] });
      toast.show(t('manage:member.updated'));
      setRoleOpen(false);
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
  const confirmStatus = (status: 'SUSPENDED' | 'LEFT') => {
    if (!m) return;
    const kind = status === 'LEFT' ? 'remove' : 'suspend';
    Alert.alert(
      t(`manage:member.${kind}Confirm`, { name: m.displayName }),
      t(`manage:member.${kind}ConfirmBody`),
      [
        { text: t('common:actions.cancel'), style: 'cancel' },
        {
          text: t(`manage:member.${kind}`),
          style: 'destructive',
          onPress: () => void setStatus(status),
        },
      ],
    );
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
          <View className="mt-4 h-[120px] overflow-hidden rounded-xl bg-card">
            <Image
              source={photos.directory}
              resizeMode="cover"
              style={{ width: '100%', height: '100%' }}
            />
          </View>
          <View className="-mt-8 items-center">
            <View className="rounded-full bg-canvas p-[3px]">
              <Avatar name={m.displayName} uri={m.avatarUrl} size={64} tone="gray" />
            </View>
            <Text variant="h2" className="mt-2">
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
          {m.vehicles && m.vehicles.length > 0 ? (
            <>
              <Text variant="h3" className="mb-3 mt-6">
                {t('society:directory.vehicles')}
              </Text>
              <Card tight className="gap-2">
                {m.vehicles.map((v) => (
                  <Row
                    key={v.id}
                    icon={slotIcon(v.type)}
                    title={formatRegistration(v.registrationNo)}
                    subtitle={[formatFlat(v.flat), v.makeModel, v.color]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                ))}
              </Card>
            </>
          ) : null}
          {canManage && !isMe ? (
            <>
              <Divider className="my-6" />
              <View className="gap-3">
                <Button label={t('manage:member.roles')} variant="gray" onPress={openRoles} />
                <Button
                  label={t('manage:member.editFlats')}
                  variant="gray"
                  onPress={() => setFlatsOpen(true)}
                />
                {m.status === 'ACTIVE' ? (
                  <Button
                    label={t('manage:member.suspend')}
                    variant="gray"
                    onPress={() => confirmStatus('SUSPENDED')}
                    loading={update.isPending}
                  />
                ) : (
                  <Button
                    label={t('manage:member.activate')}
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
                  onPress={() => confirmStatus('LEFT')}
                />
              </View>
            </>
          ) : null}
        </>
      )}
      <Sheet
        visible={roleOpen}
        onClose={() => setRoleOpen(false)}
        title={t('manage:member.roles')}
        footer={
          <Button
            label={t('common:actions.save')}
            loading={update.isPending}
            disabled={roleIds.size === 0}
            onPress={() => void saveRoles()}
          />
        }
      >
        <Text variant="label" tone="secondary" className="mb-3">
          {t('manage:member.rolesHelp')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {(roles.data ?? []).map((r) => (
            <Chip
              key={r.id}
              label={r.name}
              selected={roleIds.has(r.id)}
              onPress={() => flipRole(r.id)}
            />
          ))}
        </View>
      </Sheet>
      {m ? (
        <MemberFlatsSheet
          visible={flatsOpen}
          onClose={() => setFlatsOpen(false)}
          membershipId={m.membershipId}
          current={m.flats}
        />
      ) : null}
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
