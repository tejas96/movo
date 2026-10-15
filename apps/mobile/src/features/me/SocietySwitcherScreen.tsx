import { Button, Card, Icon, Row, Screen, TitleBar, useToast } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Alert, Image, View } from 'react-native';
import { photoUri } from '../../core/api/client';
import { queryClient } from '../../core/api/query-client';
import { societyKey } from '../../core/api/query-keys';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { invalidateContext } from '../../core/auth/auth';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useMeContext } from '../../core/tenant/hooks';
import { useTenantStore } from '../../core/tenant/tenant.store';
import { useLeaveSociety } from './api';

export function SocietySwitcherScreen() {
  const { t } = useTranslation(['society', 'onboarding', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const ctx = useMeContext();
  const activeId = useTenantStore((s) => s.activeSocietyId);
  const setActive = useTenantStore((s) => s.setActiveSocietyId);
  const leave = useLeaveSociety();
  const memberships = ctx.data?.memberships.filter((m) => m.status === 'ACTIVE') ?? [];
  const current = memberships.find((m) => m.society.id === activeId) ?? memberships[0];

  const pick = (id: string) => {
    setActive(id);
    void queryClient.invalidateQueries({ queryKey: societyKey(id) });
    nav.goBack();
  };

  // Like a membership an admin ended: move to another active society, or (none left) the
  // context refresh shows the join screens.
  const leaveCurrent = async (id: string, name: string) => {
    await withErrorToast(async () => {
      await leave.mutateAsync(id);
      const next = memberships.find((m) => m.society.id !== id);
      setActive(next?.society.id ?? null);
      if (next) nav.goBack();
      await invalidateContext();
      toast.show(t('society:leave.done', { name }));
    });
  };

  const confirmLeave = () => {
    if (!current) return;
    const { id, name } = current.society;
    Alert.alert(t('society:leave.confirmTitle', { name }), t('society:leave.confirmBody'), [
      { text: t('common:actions.cancel'), style: 'cancel' },
      {
        text: t('society:leave.confirm'),
        style: 'destructive',
        onPress: () => void leaveCurrent(id, name),
      },
    ]);
  };

  return (
    <Screen>
      <TitleBar title={t('society:mySocieties')} onBack={() => nav.goBack()} />
      <Card tight className="mt-6 gap-2">
        {memberships.map((m) => (
          <Row
            key={m.id}
            icon="building"
            leading={
              m.society.logoUrl ? (
                <Image
                  source={{ uri: photoUri(m.society.logoUrl) ?? undefined }}
                  style={{ width: 44, height: 44, borderRadius: 12 }}
                />
              ) : undefined
            }
            title={m.society.name}
            subtitle={[m.flats.map(formatFlat).join(', '), m.roles.map((r) => r.name).join(', ')]
              .filter(Boolean)
              .join(' · ')}
            trailing={
              m.society.id === current?.society.id ? (
                <Icon name="check" variant="bold" size={22} />
              ) : (
                <View className="w-[22px]" />
              )
            }
            onPress={() => pick(m.society.id)}
          />
        ))}
      </Card>
      <Button
        label={t('onboarding:title')}
        variant="gray"
        onPress={() => nav.navigate('Join')}
        className="mt-4"
      />
      {current ? (
        <Button
          label={t('society:leave.button')}
          variant="danger"
          icon="logout"
          loading={leave.isPending}
          onPress={confirmLeave}
          className="mt-10"
        />
      ) : null}
    </Screen>
  );
}
