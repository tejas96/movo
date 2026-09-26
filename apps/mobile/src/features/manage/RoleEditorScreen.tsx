import { PERMISSION_KEYS, type PermissionKey } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Card,
  Input,
  Screen,
  SectionHeader,
  Text,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId, useTenant } from '../../core/tenant/hooks';
import { useRoles } from '../directory/api';
import { useDeleteRole, useSaveRole } from './api';
import { i18nKey, PERMISSION_GROUPS } from './module-settings';

export function RoleEditorScreen() {
  const { t } = useTranslation(['manage', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const roleId = useRoute<RouteProp<RootStackParamList, 'RoleEditor'>>().params?.roleId;
  const roles = useRoles(societyId);
  const role = roles.data?.find((r) => r.id === roleId);
  const save = useSaveRole(societyId);
  const remove = useDeleteRole(societyId);
  const mine = new Set(tenant.permissions);
  const isAdminRole = role?.key === 'admin';

  const [name, setName] = useState('');
  const [perms, setPerms] = useState<Set<PermissionKey>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return;
    setName(role.name);
    setPerms(new Set(role.permissions));
  }, [role]);

  const flip = (p: PermissionKey, on: boolean) =>
    setPerms((old) => {
      const next = new Set(old);
      if (on) next.add(p);
      else next.delete(p);
      return next;
    });

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      await save.mutateAsync({
        roleId,
        name: name.trim(),
        permissions: isAdminRole ? [...PERMISSION_KEYS] : [...perms],
      });
      toast.show(t('manage:rolesScreen.saved'));
      nav.goBack();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  const drop = () => {
    if (!role) return;
    Alert.alert(t('manage:rolesScreen.deleteConfirm', { name: role.name }), undefined, [
      { text: t('common:actions.cancel'), style: 'cancel' },
      {
        text: t('common:actions.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(role.id);
            toast.show(t('manage:rolesScreen.deleted'));
            nav.goBack();
          } catch (e) {
            toast.show(toMessage(e), 'error');
          }
        },
      },
    ]);
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={roleId ? t('manage:rolesScreen.edit') : t('manage:rolesScreen.new')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6">
          <Input
            label={t('manage:rolesScreen.name')}
            placeholder={t('manage:rolesScreen.nameHint')}
            value={name}
            onChangeText={setName}
            maxLength={40}
          />
        </View>
        {isAdminRole ? (
          <Text variant="label" tone="secondary" className="mt-4">
            {t('manage:rolesScreen.adminLocked')}
          </Text>
        ) : (
          <>
            <Text variant="label" tone="secondary" className="mt-4">
              {t('manage:rolesScreen.onlyYours')}
            </Text>
            {PERMISSION_GROUPS.map((g) => (
              <View key={g.key}>
                <SectionHeader title={t(`manage:permissionGroups.${g.key}`)} />
                <Card tight className="gap-2">
                  {g.permissions.map((p) => {
                    const locked = !mine.has(p);
                    return (
                      <View
                        key={p}
                        className="flex-row items-center justify-between rounded-lg bg-card px-4 py-3"
                      >
                        <View className="flex-1 pr-3">
                          <Text variant="body" tone={locked ? 'secondary' : 'primary'}>
                            {t(`manage:permissions.${i18nKey(p)}`)}
                          </Text>
                        </View>
                        <Toggle
                          value={perms.has(p)}
                          disabled={locked}
                          onValueChange={(on) => flip(p, on)}
                        />
                      </View>
                    );
                  })}
                </Card>
              </View>
            ))}
          </>
        )}
        {error ? (
          <Text variant="caption" tone="danger" className="mt-4">
            {error}
          </Text>
        ) : null}
        {role && !role.isSystem ? (
          <Button
            label={t('manage:rolesScreen.delete')}
            variant="ghost"
            className="mt-6"
            loading={remove.isPending}
            onPress={drop}
          />
        ) : null}
      </Screen>
      <BottomBar
        label={isAdminRole ? undefined : t('manage:rolesScreen.selected')}
        value={isAdminRole ? undefined : String(perms.size)}
        action={
          <Button
            label={t('common:actions.save')}
            inline
            loading={save.isPending}
            disabled={Boolean(roleId) && !role}
            onPress={() => void submit()}
          />
        }
      />
    </>
  );
}
