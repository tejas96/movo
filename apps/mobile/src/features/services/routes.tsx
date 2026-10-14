import type { VendorStatus } from '@movo/contracts';
import { editorOptions, type FeatureRoutes } from '../../core/navigation/routes';
import { ServicesScreen } from './ServicesScreen';
import { VendorCategoriesScreen } from './VendorCategoriesScreen';
import { VendorDetailScreen } from './VendorDetailScreen';
import { VendorEditorScreen } from './VendorEditorScreen';
import { VendorListScreen } from './VendorListScreen';

export type ServicesParams = {
  Services: undefined;
  VendorList: { categoryId?: string; status?: VendorStatus; title: string };
  VendorDetail: { vendorId: string };
  VendorEditor: { vendorId?: string; categoryId?: string } | undefined;
  VendorCategories: undefined;
};

export const servicesRoutes: FeatureRoutes<ServicesParams> = {
  screens: [
    { name: 'Services', component: ServicesScreen, group: 'app' },
    { name: 'VendorList', component: VendorListScreen, group: 'app' },
    { name: 'VendorDetail', component: VendorDetailScreen, group: 'app' },
    { name: 'VendorEditor', component: VendorEditorScreen, group: 'app', options: editorOptions },
    { name: 'VendorCategories', component: VendorCategoriesScreen, group: 'app' },
  ],
};
