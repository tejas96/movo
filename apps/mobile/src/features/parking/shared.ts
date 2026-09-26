import type { ParkingSlotType, VehicleType } from '@movo/contracts';
import type { IconName } from '@movo/design-system';

/** "MH12AB1234" -> "MH 12 AB 1234", "22BH1234AA" -> "22 BH 1234 AA". Anything else as is. */
export function formatRegistration(reg: string): string {
  const state = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(reg);
  if (state) return state.slice(1).filter(Boolean).join(' ');
  const bh = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/.exec(reg);
  if (bh) return bh.slice(1).join(' ');
  return reg;
}

export function slotIcon(type: ParkingSlotType | VehicleType): IconName {
  return type === 'EV' ? 'evCharge' : 'parking';
}
