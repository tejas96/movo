import {
  DEFAULT_MODULE_ENABLED,
  MODULE_KEYS,
  type ModuleKey,
  parseModuleSettings,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import type { Prisma } from '../../generated/prisma/client';
import { ContextService } from './context.service';

@Injectable()
export class ModulesService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly context: ContextService,
  ) {}

  async list() {
    const rows = await this.tenant.client.societyModule.findMany();
    const byKey = new Map(rows.map((r) => [r.moduleKey, r]));
    return MODULE_KEYS.map((key) => {
      const row = byKey.get(key);
      return {
        key,
        enabled: row ? row.enabled : DEFAULT_MODULE_ENABLED[key],
        settings: parseModuleSettings(key, row?.settings ?? {}) as Record<string, unknown>,
      };
    });
  }

  async update(
    key: ModuleKey,
    patch: { enabled?: boolean | undefined; settings?: Record<string, unknown> | undefined },
  ) {
    const ctx = requireTenant();
    const row = await this.tenant.client.societyModule.findUnique({
      where: { societyId_moduleKey: { societyId: ctx.societyId, moduleKey: key } },
    });
    const current = parseModuleSettings(key, row?.settings ?? {}) as Record<string, unknown>;
    let next = current;
    if (patch.settings) {
      const parsed = parseModuleSettingsSafe(key, { ...current, ...patch.settings });
      if (!parsed.ok) throw ApiException.validation(parsed.issues);
      next = parsed.value;
    }
    const enabled = patch.enabled ?? row?.enabled ?? DEFAULT_MODULE_ENABLED[key];
    const updated = await this.tenant.client.societyModule.upsert({
      where: { societyId_moduleKey: { societyId: ctx.societyId, moduleKey: key } },
      update: { enabled, settings: next as Prisma.InputJsonValue },
      create: {
        societyId: ctx.societyId,
        moduleKey: key,
        enabled,
        settings: next as Prisma.InputJsonValue,
      },
    });
    await this.audit.record({
      action: 'society.module.updated',
      entityType: 'SocietyModule',
      entityId: key,
      before: { enabled: row?.enabled, settings: current },
      after: { enabled, settings: next },
    });
    this.context.invalidateSociety(ctx.societyId);
    return {
      key,
      enabled: updated.enabled,
      settings: parseModuleSettings(key, updated.settings) as Record<string, unknown>,
    };
  }
}

function parseModuleSettingsSafe(
  key: ModuleKey,
  raw: unknown,
): { ok: true; value: Record<string, unknown> } | { ok: false; issues: unknown } {
  try {
    return { ok: true, value: parseModuleSettings(key, raw) as Record<string, unknown> };
  } catch (error) {
    return { ok: false, issues: (error as { issues?: unknown }).issues ?? String(error) };
  }
}
