import { can, type TenantContext } from '../../common/tenant/tenant.types';

type ShowVehicles = 'OFF' | 'ADMINS' | 'ALL';

/**
 * Who may see vehicles of other flats. Parking managers always can. The directory setting
 * `showVehicles` opens it to contact viewers (ADMINS: committee, staff) or to everyone (ALL).
 */
export function seesAllVehicles(ctx: TenantContext): boolean {
  if (can(ctx, 'parking.manage')) return true;
  const show =
    (ctx.moduleSettings.directory as { showVehicles?: ShowVehicles } | undefined)?.showVehicles ??
    'ADMINS';
  if (show === 'ALL') return true;
  if (show === 'ADMINS') return can(ctx, 'member.view_contact');
  return false;
}

/** Who may see every slot and its flat. Managers, or everyone when the society allows it. */
export function seesAllSlots(ctx: TenantContext): boolean {
  if (can(ctx, 'parking.manage')) return true;
  return Boolean(
    (ctx.moduleSettings.parking as { membersSeeAllAllocations?: boolean } | undefined)
      ?.membersSeeAllAllocations,
  );
}
