import { editorOptions, type FeatureRoutes } from '../../core/navigation/routes';
import { MeetingDetailScreen } from './MeetingDetailScreen';
import { MeetingEditorScreen } from './MeetingEditorScreen';
import { MeetingsScreen } from './MeetingsScreen';

export type MeetingsParams = {
  Meetings: undefined;
  MeetingDetail: { meetingId: string };
  MeetingEditor: { meetingId?: string } | undefined;
};

export const meetingsRoutes: FeatureRoutes<MeetingsParams> = {
  screens: [
    { name: 'Meetings', component: MeetingsScreen, group: 'app' },
    { name: 'MeetingDetail', component: MeetingDetailScreen, group: 'app' },
    { name: 'MeetingEditor', component: MeetingEditorScreen, group: 'app', options: editorOptions },
  ],
  notifications: [{ kind: 'meeting', route: 'MeetingDetail', param: 'meetingId' }],
};
