import type { ExpenseCategory } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { isUniqueViolation } from '../../common/errors/prisma-errors';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { toCategory } from './expense-rules';

/** The society's own expense categories. */
@Injectable()
export class ExpenseCategoriesService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async listCategories(): Promise<ExpenseCategory[]> {
    const rows = await this.db.expenseCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toCategory);
  }

  async createCategory(name: string, icon: string): Promise<ExpenseCategory> {
    const ctx = requireTenant();
    const count = await this.db.expenseCategory.count();
    try {
      const row = await this.db.expenseCategory.create({
        data: { societyId: ctx.societyId, name, icon, sortOrder: count },
      });
      await this.audit.record({
        action: 'expense.category.created',
        entityType: 'ExpenseCategory',
        entityId: row.id,
        after: { name },
      });
      return toCategory(row);
    } catch (error) {
      if (isUniqueViolation(error))
        throw ApiException.conflict('CONFLICT', 'A category with this name exists');
      throw error;
    }
  }

  async updateCategory(id: string, body: { name?: string; icon?: string }) {
    const before = await this.db.expenseCategory.findUnique({ where: { id } });
    if (!before) throw ApiException.notFound('Category not found');
    try {
      const row = await this.db.expenseCategory.update({
        where: { id },
        // A renamed seeded category shows the new name, not the translation.
        data: {
          ...(body.name !== undefined ? { name: body.name, key: null } : {}),
          ...(body.icon !== undefined ? { icon: body.icon } : {}),
        },
      });
      await this.audit.record({
        action: 'expense.category.updated',
        entityType: 'ExpenseCategory',
        entityId: id,
        before: { name: before.name },
        after: { name: row.name },
      });
      return toCategory(row);
    } catch (error) {
      if (isUniqueViolation(error))
        throw ApiException.conflict('CONFLICT', 'A category with this name exists');
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    const row = await this.db.expenseCategory.findUnique({ where: { id } });
    if (!row) throw ApiException.notFound('Category not found');
    if ((await this.db.expense.count({ where: { categoryId: id } })) > 0)
      throw ApiException.conflict('CATEGORY_NOT_EMPTY', 'Move or remove its expenses first');
    await this.db.expenseCategory.delete({ where: { id } });
    await this.audit.record({
      action: 'expense.category.deleted',
      entityType: 'ExpenseCategory',
      entityId: id,
      before: { name: row.name },
    });
  }
}
