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

/**
 * The same rule as matchesAudience, as a Prisma where on the `audience` jsonb column
 * ({ type, ids }), so lists filter in SQL and a page holds `limit` rows when enough exist.
 * A viewer has a handful of roles, flats and buildings, so the OR stays short.
 */
export function audienceWhere(viewer: AudienceViewer) {
  const anyOf = (type: 'ROLES' | 'BUILDINGS' | 'FLATS', ids: readonly string[]) =>
    ids.length === 0
      ? []
      : [
          {
            AND: [
              { audience: { path: ['type'], equals: type } },
              { OR: ids.map((id) => ({ audience: { path: ['ids'], array_contains: [id] } })) },
            ],
          },
        ];
  return {
    OR: [
      { audience: { path: ['type'], equals: 'ALL' } },
      ...anyOf('ROLES', viewer.roleIds),
      ...anyOf('BUILDINGS', viewer.buildingIds),
      ...anyOf('FLATS', viewer.flatIds),
    ],
  };
}
