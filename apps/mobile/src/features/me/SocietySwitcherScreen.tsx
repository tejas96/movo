import { Button, Card, Icon, Row, Screen, TitleBar } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';
import { photoUri } from '../../core/api/client';
import { queryClient } from '../../core/api/query-client';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useMeContext } from '../../core/tenant/hooks';
import { useTenantStore } from '../../core/tenant/tenant.store';

export function SocietySwitcherScreen() {
  const { t } = useTranslation(['society', 'onboarding', 'common']);
  const nav = useNav();
  const ctx = useMeContext();
  const activeId = useTenantStore((s) => s.activeSocietyId);
  const setActive = useTenantStore((s) => s.setActiveSocietyId);
  const memberships = ctx.data?.memberships.filter((m) => m.status === 'ACTIVE') ?? [];

  const pick = (id: string) => {
    setActive(id);
    void queryClient.invalidateQueries({ queryKey: ['society', id] });
    nav.goBack();
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
              m.society.id === activeId ? (
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
    </Screen>
  );
}
