import { editorOptions, type FeatureRoutes } from '../../core/navigation/routes';
import { DutiesScreen } from './DutiesScreen';
import { DutyDetailScreen } from './DutyDetailScreen';
import { DutyEditorScreen } from './DutyEditorScreen';

export type DutiesParams = {
  Duties: undefined;
  DutyDetail: { dutyId: string };
  DutyEditor: undefined;
};

export const dutiesRoutes: FeatureRoutes<DutiesParams> = {
  screens: [
    { name: 'Duties', component: DutiesScreen, group: 'app' },
    { name: 'DutyDetail', component: DutyDetailScreen, group: 'app' },
    { name: 'DutyEditor', component: DutyEditorScreen, group: 'app', options: editorOptions },
  ],
  notifications: [{ kind: 'duty', route: 'DutyDetail', param: 'dutyId' }],
};
