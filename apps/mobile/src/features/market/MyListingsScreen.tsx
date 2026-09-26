import type { ListingStatus, ListingSummary } from '@movo/contracts';
import {
  Button,
  Card,
  EmptyState,
  IconSquare,
  photos,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  TitleBar,
  useToast,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { useListingAction, useMyListings } from './api';
import { ListingStatusPill, priceLabel, Thumb } from './shared';

const GROUPS: ListingStatus[] = ['ACTIVE', 'PAUSED', 'HIDDEN'];

export function MyListingsScreen() {
  const { t } = useTranslation(['market', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const list = useMyListings(societyId);
  const items = list.data ?? [];

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <TitleBar
        title={t('market:mine.title')}
        onBack={() => nav.goBack()}
        trailing={
          <IconSquare
            icon="add"
            variant="linear"
            tone="ink"
            accessibilityLabel={t('market:sell')}
            onPress={() => nav.navigate('ListingEditor')}
          />
        }
      />
      {list.isLoading ? (
        <Skeleton className="mt-6 h-40 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          photo={photos.market}
          icon="market"
          title={t('market:mine.empty')}
          body={t('market:mine.emptyBody')}
          actionLabel={t('market:home.sellSomething')}
          onAction={() => nav.navigate('ListingEditor')}
          className="mt-10"
        />
      ) : (
        GROUPS.map((status) => {
          const group = items.filter((l) => l.status === status);
          if (group.length === 0) return null;
          return (
            <Card key={status} tight className="gap-2">
              <SectionHeader title={t(`market:status.${status}`)} />
              {group.map((l) => (
                <MyListingRow key={l.id} listing={l} />
              ))}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

function MyListingRow({ listing: l }: { listing: ListingSummary }) {
  const { t } = useTranslation(['market', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const action = useListingAction(societyId);
  const flip = async () => {
    const next = l.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await action.mutateAsync({ listingId: l.id, action: { kind: 'status', status: next } });
      toast.show(next === 'PAUSED' ? t('market:listing.paused') : t('market:listing.resumed'));
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };
  return (
    <Row
      leading={<Thumb cover={l.cover} kind={l.kind} />}
      title={l.title}
      subtitle={[
        priceLabel(l),
        l.soldOut
          ? t('market:card.soldOut')
          : l.quantityAvailable != null
            ? t('market:card.left', { count: l.quantityAvailable })
            : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      trailing={
        l.status === 'HIDDEN' ? (
          <ListingStatusPill status={l.status} />
        ) : (
          <Button
            label={l.status === 'ACTIVE' ? t('market:listing.pause') : t('market:listing.resume')}
            variant="white"
            size="sm"
            inline
            loading={action.isPending}
            onPress={() => void flip()}
          />
        )
      }
      onPress={() => nav.navigate('Listing', { listingId: l.id })}
    />
  );
}
