import { editorOptions, type FeatureRoutes } from '../../core/navigation/routes';
import { NoticeDetailScreen } from './NoticeDetailScreen';
import { NoticeEditorScreen } from './NoticeEditorScreen';
import { NoticesScreen } from './NoticesScreen';

export type NoticesParams = {
  Notices: undefined;
  NoticeDetail: { noticeId: string };
  NoticeEditor: { noticeId?: string } | undefined;
};

export const noticesRoutes: FeatureRoutes<NoticesParams> = {
  screens: [
    { name: 'Notices', component: NoticesScreen, group: 'app' },
    { name: 'NoticeDetail', component: NoticeDetailScreen, group: 'app' },
    { name: 'NoticeEditor', component: NoticeEditorScreen, group: 'app', options: editorOptions },
  ],
  notifications: [{ kind: 'notice', route: 'NoticeDetail', param: 'noticeId' }],
};
