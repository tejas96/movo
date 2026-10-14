import { editorOptions, type FeatureRoutes } from '../../core/navigation/routes';
import { EventDetailScreen } from './EventDetailScreen';
import { EventEditorScreen } from './EventEditorScreen';
import { EventsScreen } from './EventsScreen';

export type EventsParams = {
  Events: undefined;
  EventDetail: { eventId: string };
  EventEditor: { eventId?: string } | undefined;
};

export const eventsRoutes: FeatureRoutes<EventsParams> = {
  screens: [
    { name: 'Events', component: EventsScreen, group: 'app' },
    { name: 'EventDetail', component: EventDetailScreen, group: 'app' },
    { name: 'EventEditor', component: EventEditorScreen, group: 'app', options: editorOptions },
  ],
  notifications: [{ kind: 'event', route: 'EventDetail', param: 'eventId' }],
};
