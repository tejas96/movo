import { z } from 'zod';
import {
  DisplayNameSchema,
  IdentifierSchema,
  IdSchema,
  LocaleSchema,
  PasswordSchema,
} from '../core/common';
import { defineRoute } from '../core/route';
import { SocietySummarySchema } from '../me/me.contract';

export const CreateSocietyBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(3)
      .max(40)
      .optional(),
    city: z.string().trim().max(60).optional(),
    state: z.string().trim().max(60).optional(),
    pincode: z.string().trim().max(10).optional(),
    addressLine: z.string().trim().max(200).optional(),
    defaultLocale: LocaleSchema.default('en'),
    timezone: z.string().default('Asia/Kolkata'),
    fyStartMonth: z.number().int().min(1).max(12).default(4),
    admin: z
      .object({
        identifier: IdentifierSchema,
        displayName: DisplayNameSchema,
        /** Only used when the identifier does not exist yet. */
        password: PasswordSchema.optional(),
        locale: LocaleSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const platformContract = {
  createSociety: defineRoute({
    method: 'POST',
    path: '/v1/platform/societies',
    summary: 'Create a society with default roles and modules and its first admin',
    auth: 'platform',
    body: CreateSocietyBodySchema,
    response: z.object({
      society: SocietySummarySchema,
      joinCode: z.string(),
      adminMembershipId: IdSchema,
      adminUserCreated: z.boolean(),
    }),
  }),
  listSocieties: defineRoute({
    method: 'GET',
    path: '/v1/platform/societies',
    summary: 'All societies on the platform',
    auth: 'platform',
    response: z.array(
      SocietySummarySchema.extend({
        memberCount: z.number().int(),
        flatCount: z.number().int(),
        joinCode: z.string().nullable(),
      }),
    ),
  }),
};
