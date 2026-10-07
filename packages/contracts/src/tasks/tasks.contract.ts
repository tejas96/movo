import { z } from 'zod';
import { ActorSchema, IdSchema, IsoDateSchema, IsoDateTimeSchema } from '../core/common';
import { defineRoute } from '../core/route';
import { FileRefSchema, MAX_TASK_PROOFS } from '../files/files.contract';

export const TaskStatusSchema = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'SUBMITTED',
  'COMPLETED',
  'CANCELLED',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskEventKindSchema = z.enum([
  'CREATED',
  'ASSIGNED',
  'VOLUNTEERED',
  'WITHDRAWN',
  'SUBMITTED',
  'RETURNED',
  'VERIFIED',
  'CANCELLED',
]);
export type TaskEventKind = z.infer<typeof TaskEventKindSchema>;

/** OPEN = anyone can volunteer. MINE = assigned to me. TO_VERIFY = waiting for a check. */
export const TaskViewSchema = z.enum(['OPEN', 'MINE', 'ACTIVE', 'DONE', 'TO_VERIFY']);
export type TaskView = z.infer<typeof TaskViewSchema>;

export const TaskSummarySchema = z.object({
  id: IdSchema,
  title: z.string(),
  status: TaskStatusSchema,
  points: z.number().int(),
  dueOn: IsoDateSchema.nullable(),
  assignee: ActorSchema.nullable(),
});
export type TaskSummary = z.infer<typeof TaskSummarySchema>;

export const TaskSchema = TaskSummarySchema.extend({
  description: z.string().nullable(),
  submissionNote: z.string().nullable(),
  /** Photos sent with the last "done". */
  proofs: z.array(FileRefSchema),
  createdBy: ActorSchema,
  createdAt: IsoDateTimeSchema,
  /** Newest first. */
  events: z.array(
    z.object({
      kind: TaskEventKindSchema,
      note: z.string().nullable(),
      by: ActorSchema,
      createdAt: IsoDateTimeSchema,
    }),
  ),
  canVolunteer: z.boolean(),
  canWithdraw: z.boolean(),
  canSubmit: z.boolean(),
  canVerify: z.boolean(),
  canManage: z.boolean(),
});
export type Task = z.infer<typeof TaskSchema>;

const societyParams = z.object({ societyId: IdSchema });
const taskParams = societyParams.extend({ taskId: IdSchema });

const TaskInputSchema = z
  .object({
    title: z.string().trim().min(2).max(100),
    description: z.string().trim().max(2000).nullable().optional(),
    points: z.number().int().min(0).max(100).default(0),
    dueOn: IsoDateSchema.nullable().optional(),
    /** Omitted or null = open for volunteers. */
    assigneeMembershipId: IdSchema.nullable().optional(),
  })
  .strict();

const t = 'tasks' as const;

export const tasksContract = {
  list: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/tasks',
    summary: 'Tasks by view. ACTIVE and DONE are everyone’s; TO_VERIFY needs task.verify.',
    module: t,
    params: societyParams,
    query: z.object({ view: TaskViewSchema.default('OPEN') }),
    response: z.array(TaskSummarySchema),
  }),
  get: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/tasks/:taskId',
    summary: 'One task with its history',
    module: t,
    params: taskParams,
    response: TaskSchema,
  }),
  create: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/tasks',
    summary: 'Create a task, assigned or open for volunteers',
    module: t,
    permission: 'task.manage',
    params: societyParams,
    body: TaskInputSchema,
    response: TaskSchema,
  }),
  update: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/tasks/:taskId',
    summary: 'Edit a task that is not finished',
    module: t,
    permission: 'task.manage',
    params: taskParams,
    body: TaskInputSchema.omit({ assigneeMembershipId: true }).partial(),
    response: TaskSchema,
  }),
  assign: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/tasks/:taskId/assign',
    summary: 'Give the task to a member, or open it for volunteers with null',
    module: t,
    permission: 'task.manage',
    params: taskParams,
    body: z.object({ membershipId: IdSchema.nullable() }).strict(),
    response: TaskSchema,
  }),
  volunteer: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/tasks/:taskId/volunteer',
    summary: 'Take an open task',
    module: t,
    params: taskParams,
    response: TaskSchema,
  }),
  withdraw: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/tasks/:taskId/withdraw',
    summary: 'Give a task back so someone else can take it',
    module: t,
    params: taskParams,
    response: TaskSchema,
  }),
  submit: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/tasks/:taskId/submit',
    summary: 'Say the task is done. Someone with task.verify checks it.',
    module: t,
    params: taskParams,
    body: z
      .object({
        note: z.string().trim().max(1000).optional(),
        /** TASK_PROOF uploads. They replace the photos of an earlier try. */
        proofIds: z.array(IdSchema).max(MAX_TASK_PROOFS).optional(),
      })
      .strict(),
    response: TaskSchema,
  }),
  verify: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/tasks/:taskId/verify',
    summary: 'Accept the work and award the points. Not by the person who did it.',
    module: t,
    permission: 'task.verify',
    params: taskParams,
    response: TaskSchema,
  }),
  sendBack: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/tasks/:taskId/return',
    summary: 'Send the work back with a reason',
    module: t,
    permission: 'task.verify',
    params: taskParams,
    body: z.object({ reason: z.string().trim().min(2).max(300) }).strict(),
    response: TaskSchema,
  }),
  cancel: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/tasks/:taskId/cancel',
    summary: 'Cancel a task that is not finished',
    module: t,
    permission: 'task.manage',
    params: taskParams,
    response: TaskSchema,
  }),
};
