import type { Audience } from '@movo/contracts';

export interface AudienceViewer {
  roleIds: readonly string[];
  flatIds: readonly string[];
  buildingIds: readonly string[];
}

/** Pure. Used both to filter lists for a viewer and to decide who gets notified. */
export function matchesAudience(audience: Audience, viewer: AudienceViewer): boolean {
  switch (audience.type) {
    case 'ALL':
      return true;
    case 'ROLES':
      return audience.ids.some((id) => viewer.roleIds.includes(id));
    case 'BUILDINGS':
      return audience.ids.some((id) => viewer.buildingIds.includes(id));
    case 'FLATS':
      return audience.ids.some((id) => viewer.flatIds.includes(id));
  }
}
