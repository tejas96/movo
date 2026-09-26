import {
  Button,
  Card,
  EmptyState,
  PersonCard,
  Screen,
  Skeleton,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { relative } from '../../core/util/time';
import { useDecideJoinRequest, useJoinRequests } from './api';

export function JoinRequestsScreen() {
  const { t } = useTranslation(['manage', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const list = useJoinRequests(societyId);
  const decide = useDecideJoinRequest(societyId);

  const act = async (requestId: string, approve: boolean, name: string) => {
    try {
      await decide.mutateAsync({ requestId, approve });
      toast.show(approve ? t('manage:requests.approved', { name }) : t('manage:requests.rejected'));
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <TitleBar title={t('manage:joinRequests')} onBack={() => nav.goBack()} />
      {list.isLoading ? (
        <View className="mt-4 gap-3">
          <Skeleton className="h-32 rounded-lg" />
        </View>
      ) : !list.data || list.data.length === 0 ? (
        <EmptyState
          icon="userAdd"
          title={t('manage:requests.empty')}
          body={t('manage:requests.emptyBody')}
          className="mt-10"
        />
      ) : (
        <View className="mt-4 gap-3">
          {list.data.map((r) => (
            <Card key={r.id} className="gap-3" tight>
              <PersonCard
                name={r.user.displayName}
                role={[r.user.phone ?? r.user.email, relative(r.createdAt)]
                  .filter(Boolean)
                  .join(' · ')}
                white
              />
              <Text variant="caption" className="px-2">
                {t('manage:requests.asks', {
                  flat: r.flat.buildingName
                    ? `${r.flat.buildingName}-${r.flat.number}`
                    : r.flat.number,
                  relation: t(`common:relation.${r.relationClaimed}`),
                })}
                {r.message ? `\n“${r.message}”` : ''}
              </Text>
              <View className="flex-row gap-2 px-2 pb-1">
                <Button
                  label={t('common:actions.approve')}
                  size="sm"
                  inline
                  onPress={() => void act(r.id, true, r.user.displayName)}
                  disabled={decide.isPending}
                  className="flex-1"
                />
                <Button
                  label={t('common:actions.reject')}
                  size="sm"
                  variant="white"
                  inline
                  onPress={() => void act(r.id, false, r.user.displayName)}
                  disabled={decide.isPending}
                  className="flex-1"
                />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
