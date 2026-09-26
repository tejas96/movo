import { z } from 'zod';
import { defineRoute } from '../core/route';

export const AppConfigSchema = z.object({
  minSupportedVersion: z.string(),
  latestVersion: z.string(),
  supportEmail: z.string().nullable(),
  privacyPolicyUrl: z.string().nullable(),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

export const appContract = {
  config: defineRoute({
    method: 'GET',
    path: '/v1/app/config',
    summary: 'Minimum supported app version and support links',
    auth: 'none',
    response: AppConfigSchema,
  }),
  health: defineRoute({
    method: 'GET',
    path: '/health',
    summary: 'Liveness',
    auth: 'none',
    response: z.object({ status: z.literal('ok'), version: z.string(), time: z.string() }),
  }),
};
