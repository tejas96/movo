import { z } from 'zod';
import { IdSchema, LocaleSchema, SocietyParamsSchema } from '../core/common';
import { defineRoute } from '../core/route';
import { SocietySummarySchema } from '../me/me.contract';
import { SocietySettingsSchema } from '../settings';

export const SocietyProfileSchema = SocietySummarySchema.extend({
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  addressLine: z.string().nullable(),
  fyStartMonth: z.number().int(),
  joinCode: z.string().nullable(),
  settings: SocietySettingsSchema,
  counts: z.object({
    buildings: z.number().int(),
    flats: z.number().int(),
    members: z.number().int(),
  }),
});
export type SocietyProfile = z.infer<typeof SocietyProfileSchema>;

/** Society profile and core settings. Part of societyContract. */
export const societyProfileRoutes = {
  get: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId',
    summary: 'Society profile and counts',
    params: SocietyParamsSchema,
    response: SocietyProfileSchema,
  }),
  update: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId',
    summary: 'Update the society profile or core settings',
    permission: 'society.settings.manage',
    params: SocietyParamsSchema,
    body: z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        city: z.string().trim().max(60).nullable().optional(),
        state: z.string().trim().max(60).nullable().optional(),
        pincode: z.string().trim().max(10).nullable().optional(),
        addressLine: z.string().trim().max(200).nullable().optional(),
        defaultLocale: LocaleSchema.optional(),
        fyStartMonth: z.number().int().min(1).max(12).optional(),
        settings: SocietySettingsSchema.partial().optional(),
        rotateJoinCode: z.boolean().optional(),
        /** A SOCIETY_LOGO upload, or null to remove the logo. */
        logoFileId: IdSchema.nullable().optional(),
      })
      .strict(),
    response: SocietyProfileSchema,
  }),
};
