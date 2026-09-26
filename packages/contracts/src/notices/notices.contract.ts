import { z } from 'zod';
import { AudienceSchema } from '../core/audience';
import { CursorQuerySchema, IdSchema, IsoDateTimeSchema, OkSchema, page } from '../core/common';
import { defineRoute } from '../core/route';

export const NoticeCategorySchema = z.enum([
  'GENERAL',
  'WATER',
  'ELECTRICITY',
  'MAINTENANCE',
  'SECURITY',
  'EVENT',
  'FINANCE',
  'EMERGENCY',
  'OTHER',
]);
export type NoticeCategory = z.infer<typeof NoticeCategorySchema>;

export const NoticePrioritySchema = z.enum(['NORMAL', 'IMPORTANT', 'EMERGENCY']);
export const NoticeStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const NoticeSummarySchema = z.object({
  id: IdSchema,
  title: z.string(),
  category: NoticeCategorySchema,
  priority: NoticePrioritySchema,
  isPinned: z.boolean(),
  status: NoticeStatusSchema,
  publishedAt: IsoDateTimeSchema.nullable(),
  readAt: IsoDateTimeSchema.nullable(),
  createdBy: z.object({ membershipId: IdSchema, displayName: z.string() }),
});
export type NoticeSummary = z.infer<typeof NoticeSummarySchema>;

export const NoticeSchema = NoticeSummarySchema.extend({
  body: z.string(),
  audience: AudienceSchema,
  expiresAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  /** Only filled for members who can manage notices. */
  readCount: z.number().int().nullable(),
});
export type Notice = z.infer<typeof NoticeSchema>;

const societyParams = z.object({ societyId: IdSchema });
const noticeParams = societyParams.extend({ noticeId: IdSchema });

const NoticeInputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    body: z.string().trim().min(1).max(5000),
    category: NoticeCategorySchema.default('GENERAL'),
    priority: NoticePrioritySchema.default('NORMAL'),
    audience: AudienceSchema.default({ type: 'ALL' }),
    expiresAt: IsoDateTimeSchema.nullable().optional(),
    isPinned: z.boolean().default(false),
    /** true = publish now and notify. false = keep as draft. */
    publish: z.boolean().default(true),
  })
  .strict();

export const noticesContract = {
  list: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/notices',
    summary:
      'Notices for me. Pinned first, then newest. Managers also see drafts with status=DRAFT.',
    module: 'notices',
    params: societyParams,
    query: CursorQuerySchema.extend({
      status: NoticeStatusSchema.default('PUBLISHED'),
      category: NoticeCategorySchema.optional(),
    }),
    response: page(NoticeSummarySchema),
  }),
  get: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/notices/:noticeId',
    summary: 'One notice. Reading it marks it read.',
    module: 'notices',
    params: noticeParams,
    response: NoticeSchema,
  }),
  create: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/notices',
    summary: 'Create a notice, published or draft',
    module: 'notices',
    permission: 'notice.publish',
    params: societyParams,
    body: NoticeInputSchema,
    response: NoticeSchema,
  }),
  update: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/notices/:noticeId',
    summary: 'Edit a notice. Authors edit their own; notice.manage_all edits any.',
    module: 'notices',
    permission: 'notice.publish',
    params: noticeParams,
    body: NoticeInputSchema.partial().omit({ publish: true }),
    response: NoticeSchema,
  }),
  publish: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/notices/:noticeId/publish',
    summary: 'Publish a draft and notify the audience',
    module: 'notices',
    permission: 'notice.publish',
    params: noticeParams,
    response: NoticeSchema,
  }),
  archive: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/notices/:noticeId/archive',
    summary: 'Archive a notice',
    module: 'notices',
    permission: 'notice.publish',
    params: noticeParams,
    response: NoticeSchema,
  }),
  setPinned: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/notices/:noticeId/pin',
    summary: 'Pin or unpin',
    module: 'notices',
    permission: 'notice.publish',
    params: noticeParams,
    body: z.object({ isPinned: z.boolean() }).strict(),
    response: NoticeSchema,
  }),
  markRead: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/notices/:noticeId/read',
    summary: 'Mark read without opening',
    module: 'notices',
    params: noticeParams,
    response: OkSchema,
  }),
};
