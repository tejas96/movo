import type { MeetingStatus } from '@movo/contracts';
import { StatusPill, type StatusTones } from '../ui/StatusPill';

/** SCHEDULED shows no pill. */
const MEETING_TONE: StatusTones<MeetingStatus> = {
  SCHEDULED: 'neutral',
  CANCELLED: 'danger',
  COMPLETED: 'neutral',
};

export function MeetingStatusPill({ status }: { status: MeetingStatus }) {
  if (status === 'SCHEDULED') return null;
  return <StatusPill value={status} tones={MEETING_TONE} labels="meetings:status" />;
}
