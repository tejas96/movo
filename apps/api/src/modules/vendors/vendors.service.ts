import {
  DEFAULT_VENDOR_CATEGORIES,
  type RouteBody,
  type RouteQuery,
  type Vendor,
  type VendorCategory,
  type VendorCategoryIcon,
  VendorCategoryIconSchema,
  type VendorStatus,
  type vendorsContract,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import type { Prisma } from '../../generated/prisma/client';
import { loadMemberNames } from '../tenancy/member-names';

type ListQuery = RouteQuery<typeof vendorsContract.list>;
type CreateBody = RouteBody<typeof vendorsContract.create>;
type UpdateBody = RouteBody<typeof vendorsContract.update>;

const vendorInclude = { category: true } satisfies Prisma.VendorInclude;
type VendorRow = Prisma.VendorGetPayload<{ include: typeof vendorInclude }>;

/** Approved first, then trial, then suggestions, then blocked. */
const STATUS_RANK: Record<VendorStatus, number> = {
  APPROVED: 0,
  TRIAL: 1,
  SUGGESTED: 2,
  BLOCKED: 3,
};

/** Rows for a new society. Used inside the society-create transaction. */
export function defaultVendorCategoryRows(societyId: string) {
  return DEFAULT_VENDOR_CATEGORIES.map((c, i) => ({
    societyId,
    key: c.key,
    name: c.name,
    icon: c.icon,
    sortOrder: i,
  }));
}

function iconOf(raw: string): VendorCategoryIcon {
  const parsed = VendorCategoryIconSchema.safeParse(raw);
  return parsed.success ? parsed.data : 'services';
}

@Injectable()
export class VendorsService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  private canManage(ctx: TenantContext): boolean {
    return can(ctx, 'vendor.manage');
  }

  /** Members see approved and trial vendors plus what they suggested themselves. */
  private visibleWhere(ctx: TenantContext): Prisma.VendorWhereInput {
    if (this.canManage(ctx)) return {};
    return {
      OR: [
        { status: { in: ['APPROVED', 'TRIAL'] } },
        { status: 'SUGGESTED', addedByMembershipId: ctx.membershipId },
      ],
    };
  }

  async listCategories(): Promise<VendorCategory[]> {
    const ctx = requireTenant();
    const [rows, counts] = await Promise.all([
      this.db.vendorCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.db.vendor.groupBy({
        by: ['categoryId'],
        where: {
          ...this.visibleWhere(ctx),
          ...(this.canManage(ctx) ? { status: { not: 'BLOCKED' } } : {}),
        },
        _count: { _all: true },
      }),
    ]);
    const byCategory = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return rows.map((c) => ({
      id: c.id,
      key: c.key,
      name: c.name,
      icon: iconOf(c.icon),
      sortOrder: c.sortOrder,
      vendorCount: byCategory.get(c.id) ?? 0,
    }));
  }

  async createCategory(
    body: RouteBody<typeof vendorsContract.createCategory>,
  ): Promise<VendorCategory> {
    const ctx = requireTenant();
    const count = await this.db.vendorCategory.count();
    const row = await this.db.vendorCategory.create({
      data: { societyId: ctx.societyId, name: body.name, icon: body.icon, sortOrder: count },
    });
    await this.audit.record({
      action: 'vendor.category.created',
      entityType: 'VendorCategory',
      entityId: row.id,
      after: { name: row.name },
    });
    return { ...row, icon: iconOf(row.icon), vendorCount: 0 };
  }

  async updateCategory(
    categoryId: string,
    body: RouteBody<typeof vendorsContract.updateCategory>,
  ): Promise<VendorCategory> {
    const before = await this.db.vendorCategory.findUnique({ where: { id: categoryId } });
    if (!before) throw ApiException.notFound('Category not found');
    const row = await this.db.vendorCategory.update({
      where: { id: categoryId },
      data: {
        // A renamed seeded category no longer follows the translated default name.
        ...(body.name !== undefined && body.name !== before.name
          ? { name: body.name, key: null }
          : {}),
        ...(body.icon !== undefined ? { icon: body.icon } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });
    await this.audit.record({
      action: 'vendor.category.updated',
      entityType: 'VendorCategory',
      entityId: row.id,
      before: { name: before.name, icon: before.icon },
      after: { name: row.name, icon: row.icon },
    });
    const vendorCount = await this.db.vendor.count({
      where: { categoryId, status: { not: 'BLOCKED' } },
    });
    return { ...row, icon: iconOf(row.icon), vendorCount };
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const row = await this.db.vendorCategory.findUnique({ where: { id: categoryId } });
    if (!row) throw ApiException.notFound('Category not found');
    const vendors = await this.db.vendor.count({ where: { categoryId } });
    if (vendors > 0)
      throw ApiException.conflict('CATEGORY_NOT_EMPTY', 'Move or delete the vendors first');
    await this.db.vendorCategory.delete({ where: { id: categoryId } });
    await this.audit.record({
      action: 'vendor.category.deleted',
      entityType: 'VendorCategory',
      entityId: categoryId,
      before: { name: row.name },
    });
  }

  async list(query: ListQuery): Promise<Vendor[]> {
    const ctx = requireTenant();
    const rows = await this.db.vendor.findMany({
      where: {
        AND: [
          this.visibleWhere(ctx),
          query.categoryId ? { categoryId: query.categoryId } : {},
          query.status ? { status: query.status } : {},
          query.q
            ? {
                OR: [
                  { name: { contains: query.q, mode: 'insensitive' } },
                  { description: { contains: query.q, mode: 'insensitive' } },
                  { category: { name: { contains: query.q, mode: 'insensitive' } } },
                ],
              }
            : {},
        ],
      },
      include: vendorInclude,
      take: 200,
    });
    rows.sort(
      (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name),
    );
    return this.toDtos(ctx, rows);
  }

  async get(vendorId: string): Promise<Vendor> {
    const ctx = requireTenant();
    const row = await this.db.vendor.findFirst({
      where: { AND: [{ id: vendorId }, this.visibleWhere(ctx)] },
      include: vendorInclude,
    });
    if (!row) throw ApiException.notFound('Vendor not found');
    const [dto] = await this.toDtos(ctx, [row]);
    if (!dto) throw ApiException.notFound('Vendor not found');
    return dto;
  }

  async create(body: CreateBody): Promise<Vendor> {
    const ctx = requireTenant();
    const manager = this.canManage(ctx);
    if (!manager) {
      const allowed =
        (ctx.moduleSettings.vendors as { membersCanSuggest?: boolean } | undefined)
          ?.membersCanSuggest ?? true;
      if (!allowed) throw ApiException.forbidden('Only the committee can add vendors');
    }
    await this.requireCategory(body.categoryId);
    const status: VendorStatus = manager ? (body.status ?? 'APPROVED') : 'SUGGESTED';
    const row = await this.prisma.$transaction(async (tx) => {
      const v = await tx.vendor.create({
        data: {
          societyId: ctx.societyId,
          categoryId: body.categoryId,
          name: body.name,
          phone: body.phone,
          altPhone: body.altPhone ?? null,
          description: body.description ?? null,
          availability: body.availability ?? null,
          status,
          adminNotes: manager ? (body.adminNotes ?? null) : null,
          addedByMembershipId: ctx.membershipId,
        },
        include: vendorInclude,
      });
      await this.audit.record(
        {
          action: manager ? 'vendor.created' : 'vendor.suggested',
          entityType: 'Vendor',
          entityId: v.id,
          after: { name: v.name, status: v.status },
        },
        tx,
      );
      return v;
    });
    return this.get(row.id);
  }

  async update(vendorId: string, body: UpdateBody): Promise<Vendor> {
    const before = await this.db.vendor.findUnique({ where: { id: vendorId } });
    if (!before) throw ApiException.notFound('Vendor not found');
    if (body.categoryId && body.categoryId !== before.categoryId)
      await this.requireCategory(body.categoryId);
    const row = await this.db.vendor.update({
      where: { id: vendorId },
      data: {
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.altPhone !== undefined ? { altPhone: body.altPhone } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.availability !== undefined ? { availability: body.availability } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.adminNotes !== undefined ? { adminNotes: body.adminNotes } : {}),
      },
    });
    await this.audit.record({
      action: 'vendor.updated',
      entityType: 'Vendor',
      entityId: vendorId,
      before: { name: before.name, phone: before.phone, status: before.status },
      after: { name: row.name, phone: row.phone, status: row.status },
    });
    return this.get(vendorId);
  }

  async remove(vendorId: string): Promise<void> {
    const ctx = requireTenant();
    const row = await this.db.vendor.findUnique({ where: { id: vendorId } });
    if (!row) throw ApiException.notFound('Vendor not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.vendor.deleteMany({ where: { id: vendorId, societyId: ctx.societyId } });
      await this.audit.record(
        {
          action: 'vendor.deleted',
          entityType: 'Vendor',
          entityId: vendorId,
          before: { name: row.name, phone: row.phone, status: row.status },
        },
        tx,
      );
    });
  }

  /** Suggestions waiting for a manager. Used by Home. */
  countSuggestions(): Promise<number> {
    return this.db.vendor.count({ where: { status: 'SUGGESTED' } });
  }

  private async requireCategory(categoryId: string): Promise<void> {
    const c = await this.db.vendorCategory.findUnique({ where: { id: categoryId } });
    if (!c) throw ApiException.notFound('Category not found');
  }

  private async toDtos(ctx: TenantContext, rows: VendorRow[]): Promise<Vendor[]> {
    const names = await loadMemberNames(
      this.prisma,
      rows.map((r) => r.addedByMembershipId),
    );
    const manager = this.canManage(ctx);
    return rows.map((v) => ({
      id: v.id,
      category: { id: v.category.id, key: v.category.key, name: v.category.name },
      name: v.name,
      phone: v.phone,
      altPhone: v.altPhone,
      description: v.description,
      availability: v.availability,
      status: v.status,
      adminNotes: manager ? v.adminNotes : null,
      addedBy: {
        membershipId: v.addedByMembershipId,
        displayName: names.get(v.addedByMembershipId)?.displayName ?? 'Committee',
      },
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    }));
  }
}
