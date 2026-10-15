import type { EventSummary } from '@movo/contracts';
import { StatusPill } from '@movo/design-system';
import { useTranslation } from 'react-i18next';

export function EventPill({ event }: { event: Pick<EventSummary, 'status' | 'myRsvp'> }) {
  const { t } = useTranslation('events');
  if (event.status === 'CANCELLED')
    return <StatusPill label={t('status.CANCELLED')} tone="danger" />;
  if (event.myRsvp?.response === 'GOING')
    return <StatusPill label={t('rsvp.GOING')} tone="success" dot />;
  if (event.myRsvp?.response === 'MAYBE')
    return <StatusPill label={t('rsvp.MAYBE')} tone="warning" />;
  return null;
}
