import { z } from 'zod';
import { SocietyParamsSchema } from '../core/common';
import { ModuleKeySchema } from '../core/enums';
import { defineRoute } from '../core/route';
import { ModuleStateSchema } from '../me/me.contract';

/** Module switches and module settings. Part of societyContract. */
export const societyModuleRoutes = {
  listModules: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/modules',
    summary: 'Module switches and settings',
    permission: 'society.settings.manage',
    params: SocietyParamsSchema,
    response: z.array(ModuleStateSchema),
  }),
  updateModule: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/modules/:moduleKey',
    summary: 'Switch a module on or off, or change its settings',
    permission: 'society.settings.manage',
    params: SocietyParamsSchema.extend({ moduleKey: ModuleKeySchema }),
    body: z
      .object({
        enabled: z.boolean().optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
    response: ModuleStateSchema,
  }),
};
