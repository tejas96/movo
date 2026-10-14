import type { AlertStatus, AlertType, EmergencyContactType } from '@movo/contracts';
import type { BoldIconName } from '@movo/design-system';
import type { StatusTones } from '../../core/ui/StatusPill';

export const ALERT_ICON: Record<AlertType, BoldIconName> = {
  MEDICAL: 'hospital',
  FIRE: 'fire',
  SECURITY: 'security',
  LIFT: 'lift',
  GAS: 'gas',
  OTHER: 'warning',
};

export const CONTACT_ICON: Record<EmergencyContactType, BoldIconName> = {
  MEDICAL: 'hospital',
  FIRE: 'fire',
  POLICE: 'shield',
  SECURITY: 'security',
  LIFT: 'lift',
  ADMIN: 'building',
  OTHER: 'callCalling',
};

export const ALERT_STATUS_TONE: StatusTones<AlertStatus> = {
  ACTIVE: 'danger',
  RESOLVED: 'neutral',
  FALSE_ALARM: 'neutral',
};
