import {
  Card,
  Icon,
  IconSquare,
  Screen,
  Skeleton,
  Text,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { useModules, useUpdateModule } from './api';
import { MANAGED_MODULES, MODULE_ICON, MODULE_SETTINGS } from './module-settings';

export function ModulesScreen() {
  const { t } = useTranslation(['manage', 'society', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const modules = useModules(societyId);
  const update = useUpdateModule(societyId);
  const byKey = new Map((modules.data ?? []).map((m) => [m.key, m]));

  const flip = async (key: (typeof MANAGED_MODULES)[number], enabled: boolean) => {
    try {
      await update.mutateAsync({ moduleKey: key, enabled });
      toast.show(
        enabled ? t('manage:modulesScreen.turnedOn') : t('manage:modulesScreen.turnedOff'),
      );
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen refreshing={modules.isRefetching} onRefresh={() => void modules.refetch()}>
      <TitleBar title={t('manage:modulesScreen.title')} onBack={() => nav.goBack()} />
      <Text variant="label" tone="secondary" className="mt-4">
        {t('manage:modulesScreen.help')}
      </Text>
      {modules.isLoading ? (
        <Skeleton className="mt-4 h-96 rounded-xl" />
      ) : (
        <Card tight className="mt-4 gap-2">
          {MANAGED_MODULES.map((key) => {
            const m = byKey.get(key);
            if (!m) return null;
            const hasSettings = Boolean(MODULE_SETTINGS[key]?.length);
            return (
              <View
                key={key}
                className="flex-row items-center gap-3 rounded-lg bg-card px-3 py-2.5"
              >
                <Pressable
                  className="flex-1 flex-row items-center gap-3"
                  disabled={!hasSettings || !m.enabled}
                  onPress={() => nav.navigate('ModuleSettings', { moduleKey: key })}
                >
                  <IconSquare icon={MODULE_ICON[key]} variant="linear" tone="white" size="sm" />
                  <View className="flex-1 min-w-0">
                    <Text variant="bodyMedium">{t(`society:modules.${key}`)}</Text>
                    <Text variant="caption" tone="secondary" numberOfLines={2}>
                      {t(`manage:moduleHelp.${key}`)}
                    </Text>
                  </View>
                  {hasSettings && m.enabled ? <Icon name="chevronRight" size={18} /> : null}
                </Pressable>
                <Toggle
                  value={m.enabled}
                  disabled={update.isPending}
                  onValueChange={(v) => void flip(key, v)}
                />
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
