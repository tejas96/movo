import { Card, IconSquare, Pill, Row, Screen, Skeleton, TitleBar } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { useRoles } from '../directory/api';

export function RolesScreen() {
  const { t } = useTranslation(['manage', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const roles = useRoles(societyId);

  return (
    <Screen refreshing={roles.isRefetching} onRefresh={() => void roles.refetch()}>
      <TitleBar
        title={t('manage:rolesScreen.title')}
        onBack={() => nav.goBack()}
        trailing={
          <IconSquare
            icon="add"
            variant="linear"
            tone="ink"
            onPress={() => nav.navigate('RoleEditor')}
          />
        }
      />
      {roles.isLoading ? (
        <View className="mt-6 gap-3">
          <Skeleton className="h-[68px]" />
          <Skeleton className="h-[68px]" />
        </View>
      ) : (
        <Card tight className="mt-6 gap-2">
          {(roles.data ?? []).map((r) => (
            <Row
              key={r.id}
              icon={r.key === 'admin' ? 'verified' : 'shield'}
              title={r.name}
              subtitle={[
                t('manage:rolesScreen.members', { count: r.memberCount }),
                t('manage:rolesScreen.permissionCount', { count: r.permissions.length }),
              ].join(' · ')}
              trailing={
                r.isSystem ? (
                  <Pill label={t('manage:rolesScreen.builtIn')} tone="gray" size="sm" />
                ) : undefined
              }
              onPress={() => nav.navigate('RoleEditor', { roleId: r.id })}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
