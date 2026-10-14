import { parseModuleSettings } from '@movo/contracts';
import { can, type TenantContext } from '../../common/tenant/tenant.types';

/**
 * Who may see vehicles of other flats. Parking managers always can. The directory setting
 * `showVehicles` opens it to contact viewers (ADMINS: committee, staff) or to everyone (ALL).
 */
export function seesAllVehicles(ctx: TenantContext): boolean {
  if (can(ctx, 'parking.manage')) return true;
  const show = parseModuleSettings('directory', ctx.moduleSettings.directory).showVehicles;
  if (show === 'ALL') return true;
  if (show === 'ADMINS') return can(ctx, 'member.view_contact');
  return false;
}

/** Who may see every slot and its flat. Managers, or everyone when the society allows it. */
export function seesAllSlots(ctx: TenantContext): boolean {
  if (can(ctx, 'parking.manage')) return true;
  return parseModuleSettings('parking', ctx.moduleSettings.parking).membersSeeAllAllocations;
}
