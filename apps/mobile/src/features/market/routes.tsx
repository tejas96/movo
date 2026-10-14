import type { ListingKind, ModuleKey, OrderRole } from '@movo/contracts';
import { editorOptions, type FeatureRoutes } from '../../core/navigation/routes';
import { ComingSoonScreen } from './ComingSoonScreen';
import { ListingDetailScreen } from './ListingDetailScreen';
import { ListingEditorScreen } from './ListingEditorScreen';
import { MarketReportsScreen } from './MarketReportsScreen';
import { MyListingsScreen } from './MyListingsScreen';
import { OrderDetailScreen } from './OrderDetailScreen';
import { OrdersScreen } from './OrdersScreen';

export type MarketParams = {
  ComingSoon: { moduleKey: ModuleKey | 'documents'; title: string };
  Listing: { listingId: string };
  ListingEditor: { listingId?: string; kind?: ListingKind } | undefined;
  MyListings: undefined;
  Orders: { role?: OrderRole } | undefined;
  OrderDetail: { orderId: string };
  MarketReports: undefined;
};

export const marketRoutes: FeatureRoutes<MarketParams> = {
  screens: [
    { name: 'ComingSoon', component: ComingSoonScreen, group: 'app' },
    { name: 'Listing', component: ListingDetailScreen, group: 'app' },
    { name: 'ListingEditor', component: ListingEditorScreen, group: 'app', options: editorOptions },
    { name: 'MyListings', component: MyListingsScreen, group: 'app' },
    { name: 'Orders', component: OrdersScreen, group: 'app' },
    { name: 'OrderDetail', component: OrderDetailScreen, group: 'app' },
    { name: 'MarketReports', component: MarketReportsScreen, group: 'app' },
  ],
  notifications: [
    { kind: 'listing', route: 'Listing', param: 'listingId' },
    { kind: 'order', route: 'OrderDetail', param: 'orderId' },
  ],
};
