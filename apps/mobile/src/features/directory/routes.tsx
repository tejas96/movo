import type { FeatureRoutes } from '../../core/navigation/routes';
import { DirectoryScreen } from './DirectoryScreen';
import { MemberDetailScreen } from './MemberDetailScreen';

export type DirectoryParams = {
  Directory: { manage?: boolean } | undefined;
  MemberDetail: { membershipId: string };
};

export const directoryRoutes: FeatureRoutes<DirectoryParams> = {
  screens: [
    { name: 'Directory', component: DirectoryScreen, group: 'app' },
    { name: 'MemberDetail', component: MemberDetailScreen, group: 'app' },
  ],
};
