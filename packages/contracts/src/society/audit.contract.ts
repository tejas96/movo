import { z } from 'zod';
import {
  CursorQuerySchema,
  IdSchema,
  IsoDateTimeSchema,
  page,
  SocietyParamsSchema,
} from '../core/common';
import { AuditActionSchema } from '../core/enums';
import { defineRoute } from '../core/route';

export const AUDIT_AREAS = {
  society: ['society.', 'building.', 'flat.', 'role.'],
  members: ['member.', 'invitation.', 'join_request.', 'user.'],
  notices: ['notice.'],
  meetings: ['meeting.', 'event.'],
  money: ['billing_plan.', 'bills.', 'bill.', 'payment.', 'payment_instruction.'],
  expenses: ['expense.', 'income.'],
  duties: ['duty.', 'task.', 'points.'],
  services: ['vendor.', 'parking.', 'vehicle.', 'emergency.', 'alert.'],
} as const;
export const AuditAreaSchema = z.enum([
  'society',
  'members',
  'notices',
  'meetings',
  'money',
  'expenses',
  'duties',
  'services',
]);
export type AuditArea = z.infer<typeof AuditAreaSchema>;

export const AuditEntrySchema = z.object({
  id: IdSchema,
  action: AuditActionSchema,
  entityType: z.string(),
  entityId: z.string().nullable(),
  /** null for system jobs and platform actions. */
  actor: z.object({ membershipId: IdSchema.nullable(), displayName: z.string() }).nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

/** Audit log. Part of societyContract. */
export const societyAuditRoutes = {
  listAudit: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/audit',
    summary: 'Audit log, newest first',
    permission: 'audit.view',
    params: SocietyParamsSchema,
    query: CursorQuerySchema.extend({
      area: AuditAreaSchema.optional(),
      entityId: z.string().max(64).optional(),
    }),
    response: page(AuditEntrySchema),
  }),
};
