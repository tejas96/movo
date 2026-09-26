import { Button, EmptyState, Screen, TitleBar, useToast } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useMeContext } from '../../core/tenant/hooks';
import { useCancelJoinRequest } from './api';

export function PendingScreen() {
  const { t } = useTranslation(['onboarding', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const ctx = useMeContext();
  const cancel = useCancelJoinRequest();
  const pending = ctx.data?.pendingJoinRequests[0];

  const withdraw = async () => {
    if (!pending) return;
    try {
      await cancel.mutateAsync(pending.id);
      nav.navigate('Join');
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen refreshing={ctx.isFetching} onRefresh={() => void ctx.refetch()}>
      <TitleBar title={t('onboarding:pendingTitle')} onBack={() => nav.navigate('Join')} />
      <View className="flex-1 justify-center py-10">
        <EmptyState
          icon="clock"
          title={pending?.society.name ?? t('onboarding:pendingTitle')}
          body={
            pending
              ? t('onboarding:pendingBody', {
                  society: pending.society.name,
                  flat: pending.buildingName
                    ? `${pending.buildingName}-${pending.flatNumber}`
                    : pending.flatNumber,
                })
              : undefined
          }
        />
        <View className="mt-4 gap-3">
          <Button
            label={t('onboarding:orInvite')}
            variant="gray"
            onPress={() => nav.navigate('Join')}
          />
          {pending ? (
            <Button
              label={t('onboarding:cancelRequest')}
              variant="ghost"
              onPress={() => void withdraw()}
              loading={cancel.isPending}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
