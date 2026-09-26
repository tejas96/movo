import type { AlertType, EmergencyContactType } from '@movo/contracts';
import type { IconName } from '@movo/design-system';

export const ALERT_ICON: Record<AlertType, IconName> = {
  MEDICAL: 'hospital',
  FIRE: 'fire',
  SECURITY: 'security',
  LIFT: 'lift',
  GAS: 'gas',
  OTHER: 'warning',
};

export const CONTACT_ICON: Record<EmergencyContactType, IconName> = {
  MEDICAL: 'hospital',
  FIRE: 'fire',
  POLICE: 'shield',
  SECURITY: 'security',
  LIFT: 'lift',
  ADMIN: 'building',
  OTHER: 'callCalling',
};
