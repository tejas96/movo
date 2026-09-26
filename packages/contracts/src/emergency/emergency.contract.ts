import { z } from 'zod';
import {
  ActorSchema,
  CursorQuerySchema,
  FlatRefSchema,
  IdSchema,
  IsoDateTimeSchema,
  OkSchema,
  PhoneSchema,
  page,
} from '../core/common';
import { defineRoute } from '../core/route';

export const EmergencyContactTypeSchema = z.enum([
  'MEDICAL',
  'FIRE',
  'POLICE',
  'SECURITY',
  'LIFT',
  'ADMIN',
  'OTHER',
]);
export type EmergencyContactType = z.infer<typeof EmergencyContactTypeSchema>;

/** Short numbers such as 112 or 101 are allowed, so this is not E.164. */
export const DialNumberSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{1,18}[0-9]$/, 'Digits only, optional leading +');

export const EmergencyContactSchema = z.object({
  id: IdSchema,
  label: z.string(),
  phone: z.string(),
  type: EmergencyContactTypeSchema,
  sortOrder: z.number().int(),
  /** 112, 101, 108 and the like. Shown in a separate group. */
  isPublicNumber: z.boolean(),
});
export type EmergencyContact = z.infer<typeof EmergencyContactSchema>;

/** India's national numbers. Seeded into every new society as public numbers. */
export const DEFAULT_PUBLIC_EMERGENCY_CONTACTS: readonly {
  label: string;
  phone: string;
  type: EmergencyContactType;
}[] = [
  { label: 'Emergency (all services)', phone: '112', type: 'OTHER' },
  { label: 'Police', phone: '100', type: 'POLICE' },
  { label: 'Fire', phone: '101', type: 'FIRE' },
  { label: 'Ambulance', phone: '108', type: 'MEDICAL' },
];

export const AlertTypeSchema = z.enum(['MEDICAL', 'FIRE', 'SECURITY', 'LIFT', 'GAS', 'OTHER']);
export type AlertType = z.infer<typeof AlertTypeSchema>;

export const AlertStatusSchema = z.enum(['ACTIVE', 'RESOLVED', 'FALSE_ALARM']);
export type AlertStatus = z.infer<typeof AlertStatusSchema>;

export const AlertSchema = z.object({
  id: IdSchema,
  type: AlertTypeSchema,
  status: AlertStatusSchema,
  source: z.enum(['USER', 'DEVICE']),
  message: z.string().nullable(),
  /** The raiser's phone is shared with everyone alerted, so neighbours can call back. */
  raisedBy: ActorSchema.extend({ phone: PhoneSchema.nullable() }).nullable(),
  flat: FlatRefSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  resolvedAt: IsoDateTimeSchema.nullable(),
  resolvedBy: ActorSchema.nullable(),
  resolutionNote: z.string().nullable(),
  /** true when this viewer raised it or holds emergency.alert.resolve. */
  canResolve: z.boolean(),
});
export type Alert = z.infer<typeof AlertSchema>;

const societyParams = z.object({ societyId: IdSchema });
const contactParams = societyParams.extend({ contactId: IdSchema });
const alertParams = societyParams.extend({ alertId: IdSchema });

const ContactInputSchema = z.object({
  label: z.string().trim().min(2).max(60),
  phone: DialNumberSchema,
  type: EmergencyContactTypeSchema.default('OTHER'),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  isPublicNumber: z.boolean().default(false),
});

export const emergencyContract = {
  listContacts: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/emergency/contacts',
    summary: 'Emergency contacts in display order',
    module: 'emergency',
    params: societyParams,
    response: z.array(EmergencyContactSchema),
  }),
  createContact: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/emergency/contacts',
    summary: 'Add a contact',
    module: 'emergency',
    permission: 'emergency.contacts.manage',
    params: societyParams,
    body: ContactInputSchema.strict(),
    response: EmergencyContactSchema,
  }),
  updateContact: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/emergency/contacts/:contactId',
    summary: 'Edit a contact',
    module: 'emergency',
    permission: 'emergency.contacts.manage',
    params: contactParams,
    body: ContactInputSchema.partial().strict(),
    response: EmergencyContactSchema,
  }),
  deleteContact: defineRoute({
    method: 'DELETE',
    path: '/v1/societies/:societyId/emergency/contacts/:contactId',
    summary: 'Remove a contact',
    module: 'emergency',
    permission: 'emergency.contacts.manage',
    params: contactParams,
    response: OkSchema,
  }),

  listAlerts: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/emergency/alerts',
    summary: 'Alerts, newest first. Default: active ones.',
    module: 'emergency',
    params: societyParams,
    query: CursorQuerySchema.extend({ status: z.enum(['ACTIVE', 'CLOSED']).default('ACTIVE') }),
    response: page(AlertSchema),
  }),
  getAlert: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/emergency/alerts/:alertId',
    summary: 'One alert',
    module: 'emergency',
    params: alertParams,
    response: AlertSchema,
  }),
  raiseAlert: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/emergency/alerts',
    summary:
      'Raise an alert. Notifies the society at once. One alert per member per cooldown window.',
    module: 'emergency',
    params: societyParams,
    body: z
      .object({
        type: AlertTypeSchema,
        message: z.string().trim().max(280).nullable().optional(),
        /** Defaults to the member's primary flat. */
        flatId: IdSchema.nullable().optional(),
      })
      .strict(),
    response: AlertSchema,
  }),
  resolveAlert: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/emergency/alerts/:alertId/resolve',
    summary: 'Close an alert as resolved or a false alarm. The raiser or a resolver can do this.',
    module: 'emergency',
    params: alertParams,
    body: z
      .object({
        outcome: z.enum(['RESOLVED', 'FALSE_ALARM']),
        note: z.string().trim().max(280).nullable().optional(),
      })
      .strict(),
    response: AlertSchema,
  }),
};
