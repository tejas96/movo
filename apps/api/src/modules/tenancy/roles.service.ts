import {
  type PermissionKey,
  ROLE_TEMPLATE_KEYS,
  ROLE_TEMPLATE_PERMISSIONS,
  type RoleTemplateKey,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import type { Prisma } from '../../generated/prisma/client';

export const ROLE_TEMPLATE_NAMES: Record<RoleTemplateKey, string> = {
  admin: 'Admin',
  committee: 'Committee member',
  treasurer: 'Treasurer',
  resident: 'Resident',
  staff: 'Staff',
};

/** Rows to create for a new society. Used inside the society creation transaction. */
export function roleTemplateRows(societyId: string): Prisma.RoleCreateManyInput[] {
  return ROLE_TEMPLATE_KEYS.map((key, i) => ({
    societyId,
    key,
    name: ROLE_TEMPLATE_NAMES[key],
    isSystem: true,
    sortOrder: i,
  }));
}

export function rolePermissionRows(
  roleIdByKey: Record<string, string>,
): Prisma.RolePermissionCreateManyInput[] {
  const rows: Prisma.RolePermissionCreateManyInput[] = [];
  for (const key of ROLE_TEMPLATE_KEYS) {
    const roleId = roleIdByKey[key];
    if (!roleId) continue;
    for (const permissionKey of ROLE_TEMPLATE_PERMISSIONS[key])
      rows.push({ roleId, permissionKey });
  }
  return rows;
}

@Injectable()
export class RolesService {
  constructor(private readonly tenant: TenantPrismaService) {}

  async list() {
    const roles = await this.tenant.client.role.findMany({
      include: { permissions: true, _count: { select: { members: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      isSystem: r.isSystem,
      permissions: r.permissions.map((p) => p.permissionKey as PermissionKey).sort(),
      memberCount: r._count.members,
    }));
  }

  async requireRoles(ids: string[]) {
    const roles = await this.tenant.client.role.findMany({ where: { id: { in: ids } } });
    if (roles.length !== new Set(ids).size) throw ApiException.notFound('Role not found');
    return roles;
  }

  async residentRole() {
    const role = await this.tenant.client.role.findFirst({ where: { key: 'resident' } });
    if (!role) throw new Error('Society has no resident role');
    return role;
  }
}
