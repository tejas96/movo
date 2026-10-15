import { PERMISSION_KEYS, type PermissionKey, type Role, societyContract } from '@movo/contracts';
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
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { bodyResolver, formMessage, usePrefill } from '../../core/forms/contract-form';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId, useTenant } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { useRoles } from '../directory/api';
import { useDeleteRole, useSaveRole } from './api';
import { i18nKey, PERMISSION_GROUPS } from './module-settings';

interface RoleForm {
  name: string;
  /** No duplicates, in the order they were switched on (same as the Set it replaces). */
  permissions: PermissionKey[];
}

const EMPTY: RoleForm = { name: '', permissions: [] };

function toForm(role: Role): RoleForm {
  return { name: role.name, permissions: [...new Set(role.permissions)] };
}

/** The admin role always keeps every permission. */
function toBody(v: RoleForm, isAdminRole: boolean) {
  return {
    name: v.name.trim(),
    permissions: isAdminRole ? [...PERMISSION_KEYS] : v.permissions,
  };
}

export function RoleEditorScreen() {
  const { t } = useTranslation(['manage', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const roleId = useRoute<RouteProp<RootStackParamList, 'RoleEditor'>>().params?.roleId;
  const roles = useRoles(societyId);
  const role = roles.data?.find((r) => r.id === roleId);
  const save = useSaveRole(societyId);
  const remove = useDeleteRole(societyId);
  const mine = new Set(tenant.permissions);
  // The admin role keeps every permission; the server says so with canEditPermissions.
  const isAdminRole = role ? !role.canEditPermissions : false;

  const form = useForm<RoleForm>({
    resolver: bodyResolver(
      roleId ? societyContract.updateRole.body : societyContract.createRole.body,
      (v: RoleForm) => toBody(v, isAdminRole),
    ),
    defaultValues: EMPTY,
    reValidateMode: 'onSubmit',
  });
  usePrefill(form, role, toForm);
  const error = formMessage(form, t('common:validation.required'));
  const perms = form.watch('permissions');

  const flip = (p: PermissionKey, on: boolean) => {
    const old = form.getValues('permissions').filter((x) => x !== p);
    form.setValue('permissions', on ? [...old, p] : old);
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ roleId, ...toBody(values, isAdminRole) });
      toast.show(t('manage:rolesScreen.saved'));
      nav.goBack();
    } catch (e) {
      form.setError('root.server', { message: toMessage(e) });
    }
  });

  const drop = () => {
    if (!role) return;
    Alert.alert(t('manage:rolesScreen.deleteConfirm', { name: role.name }), undefined, [
      { text: t('common:actions.cancel'), style: 'cancel' },
      {
        text: t('common:actions.delete'),
        style: 'destructive',
        onPress: async () => {
          await withErrorToast(async () => {
            await remove.mutateAsync(role.id);
            toast.show(t('manage:rolesScreen.deleted'));
            nav.goBack();
          });
        },
      },
    ]);
  };

  if (roleId && loadFailed(roles))
    return (
      <Screen>
        <TitleBar title={t('manage:rolesScreen.edit')} onBack={() => nav.goBack()} />
        <QueryError query={roles} className="mt-10" />
      </Screen>
    );

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={roleId ? t('manage:rolesScreen.edit') : t('manage:rolesScreen.new')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6">
          <Controller
            control={form.control}
            name="name"
            render={({ field }) => (
              <Input
                label={t('manage:rolesScreen.name')}
                placeholder={t('manage:rolesScreen.nameHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={40}
              />
            )}
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
                          value={perms.includes(p)}
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
        {role?.canDelete ? (
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
        value={isAdminRole ? undefined : String(perms.length)}
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
