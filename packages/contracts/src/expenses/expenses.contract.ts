import { z } from 'zod';
import {
  ActorSchema,
  CursorQuerySchema,
  IdSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  OkSchema,
  PaiseSchema,
  page,
} from '../core/common';
import { defineRoute } from '../core/route';
import { PaymentMethodSchema } from '../maintenance/maintenance.contract';
import { type VendorCategoryIcon, VendorCategoryIconSchema } from '../vendors/vendors.contract';

export const ExpenseStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type ExpenseStatus = z.infer<typeof ExpenseStatusSchema>;

export const IncomeKindSchema = z.enum([
  'DONATION',
  'INTEREST',
  'HALL_BOOKING',
  'PENALTY',
  'OTHER',
]);
export type IncomeKind = z.infer<typeof IncomeKindSchema>;

/** Seeded into every new society. `key` lets the app show the name in the member's language. */
export const DEFAULT_EXPENSE_CATEGORIES: readonly {
  key: string;
  name: string;
  icon: VendorCategoryIcon;
}[] = [
  { key: 'electricity', name: 'Electricity', icon: 'electricity' },
  { key: 'water', name: 'Water', icon: 'water' },
  { key: 'security', name: 'Security', icon: 'security' },
  { key: 'housekeeping', name: 'Housekeeping', icon: 'cleaning' },
  { key: 'lift', name: 'Lift maintenance', icon: 'lift' },
  { key: 'repairs', name: 'Repairs', icon: 'tools' },
  { key: 'salaries', name: 'Staff salaries', icon: 'people' },
  { key: 'office', name: 'Office and admin', icon: 'bag' },
  { key: 'events', name: 'Events', icon: 'cup' },
  { key: 'other', name: 'Other', icon: 'box' },
];

export const ExpenseCategorySchema = z.object({
  id: IdSchema,
  /** Set for seeded categories. null for ones the committee added. */
  key: z.string().nullable(),
  name: z.string(),
  icon: VendorCategoryIconSchema,
  sortOrder: z.number().int(),
});
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

export const ExpenseSummarySchema = z.object({
  id: IdSchema,
  category: ExpenseCategorySchema,
  amountPaise: PaiseSchema,
  incurredOn: IsoDateSchema,
  payeeName: z.string(),
  description: z.string().nullable(),
  status: ExpenseStatusSchema,
});
export type ExpenseSummary = z.infer<typeof ExpenseSummarySchema>;

export const ExpenseSchema = ExpenseSummarySchema.extend({
  method: PaymentMethodSchema,
  reference: z.string().nullable(),
  financialYear: z.string(),
  createdBy: ActorSchema,
  decidedBy: ActorSchema.nullable(),
  decidedAt: IsoDateTimeSchema.nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  /** The viewer holds expense.approve, did not create it, and it is pending. */
  canDecide: z.boolean(),
  /** Pending or rejected, and the viewer created it or can approve. */
  canEdit: z.boolean(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const IncomeEntrySchema = z.object({
  id: IdSchema,
  kind: IncomeKindSchema,
  amountPaise: PaiseSchema,
  receivedOn: IsoDateSchema,
  description: z.string().nullable(),
  createdBy: ActorSchema,
  createdAt: IsoDateTimeSchema,
});
export type IncomeEntry = z.infer<typeof IncomeEntrySchema>;

export const FinanceReportSchema = z.object({
  financialYear: z.string(),
  /** Years that have money in them, newest first, always including the current one. */
  years: z.array(z.string()),
  income: z.object({
    maintenancePaise: PaiseSchema,
    byKind: z.array(z.object({ kind: IncomeKindSchema, amountPaise: PaiseSchema })),
    totalPaise: PaiseSchema,
  }),
  expenses: z.object({
    totalPaise: PaiseSchema,
    byCategory: z.array(
      z.object({
        category: ExpenseCategorySchema,
        amountPaise: PaiseSchema,
        count: z.number().int(),
      }),
    ),
  }),
  /** Income minus approved expenses. Can be negative. */
  netPaise: z.number().int(),
  /** Month by month, April to March. */
  months: z.array(
    z.object({ month: z.string(), incomePaise: PaiseSchema, expensePaise: PaiseSchema }),
  ),
  /** Only for finance.reports.view. */
  pending: z.object({ count: z.number().int(), amountPaise: PaiseSchema }).nullable(),
  outstandingDuesPaise: PaiseSchema.nullable(),
});
export type FinanceReport = z.infer<typeof FinanceReportSchema>;

const societyParams = z.object({ societyId: IdSchema });
const expenseParams = societyParams.extend({ expenseId: IdSchema });
const categoryParams = societyParams.extend({ categoryId: IdSchema });
const incomeParams = societyParams.extend({ incomeId: IdSchema });

const ExpenseInputSchema = z
  .object({
    categoryId: IdSchema,
    amountPaise: PaiseSchema.min(1).max(1_000_000_000),
    incurredOn: IsoDateSchema,
    payeeName: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).nullable().optional(),
    method: PaymentMethodSchema.default('BANK_TRANSFER'),
    reference: z.string().trim().max(80).nullable().optional(),
  })
  .strict();

const FyQuerySchema = z.object({
  fy: z
    .string()
    .regex(/^\d{4}(-\d{2})?$/)
    .optional(),
});

const x = 'expenses' as const;

export const expensesContract = {
  listCategories: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/expenses/categories',
    summary: 'Expense categories',
    module: x,
    params: societyParams,
    response: z.array(ExpenseCategorySchema),
  }),
  createCategory: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/expenses/categories',
    summary: 'Add a category',
    module: x,
    permission: 'expense.manage_categories',
    params: societyParams,
    body: z
      .object({
        name: z.string().trim().min(2).max(40),
        icon: VendorCategoryIconSchema.default('box'),
      })
      .strict(),
    response: ExpenseCategorySchema,
  }),
  updateCategory: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/expenses/categories/:categoryId',
    summary: 'Rename a category or change its icon',
    module: x,
    permission: 'expense.manage_categories',
    params: categoryParams,
    body: z
      .object({
        name: z.string().trim().min(2).max(40).optional(),
        icon: VendorCategoryIconSchema.optional(),
      })
      .strict(),
    response: ExpenseCategorySchema,
  }),
  deleteCategory: defineRoute({
    method: 'DELETE',
    path: '/v1/societies/:societyId/expenses/categories/:categoryId',
    summary: 'Remove an empty category',
    module: x,
    permission: 'expense.manage_categories',
    params: categoryParams,
    response: OkSchema,
  }),
  list: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/expenses',
    summary:
      'Expenses, newest first. Finance roles see every status; members see approved ones only when the society shares details.',
    module: x,
    params: societyParams,
    query: CursorQuerySchema.extend(FyQuerySchema.shape).extend({
      status: ExpenseStatusSchema.optional(),
      categoryId: IdSchema.optional(),
    }),
    response: page(ExpenseSummarySchema),
  }),
  get: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/expenses/:expenseId',
    summary: 'One expense',
    module: x,
    params: expenseParams,
    response: ExpenseSchema,
  }),
  create: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/expenses',
    summary:
      'Add an expense. It needs approval when the society setting says so. A repeated idempotencyKey returns the first one.',
    module: x,
    permission: 'expense.create',
    params: societyParams,
    body: ExpenseInputSchema.extend({ idempotencyKey: z.string().min(8).max(64) }).strict(),
    response: ExpenseSchema,
  }),
  update: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/expenses/:expenseId',
    summary: 'Edit a pending or rejected expense. It goes back for approval if needed.',
    module: x,
    params: expenseParams,
    body: ExpenseInputSchema.partial(),
    response: ExpenseSchema,
  }),
  approve: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/expenses/:expenseId/approve',
    summary: 'Approve. Not by the person who added it.',
    module: x,
    permission: 'expense.approve',
    params: expenseParams,
    response: ExpenseSchema,
  }),
  reject: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/expenses/:expenseId/reject',
    summary: 'Reject with a reason. Not by the person who added it.',
    module: x,
    permission: 'expense.approve',
    params: expenseParams,
    body: z.object({ reason: z.string().trim().min(2).max(300) }).strict(),
    response: ExpenseSchema,
  }),
  remove: defineRoute({
    method: 'DELETE',
    path: '/v1/societies/:societyId/expenses/:expenseId',
    summary: 'Remove a pending or rejected expense',
    module: x,
    params: expenseParams,
    response: OkSchema,
  }),
  listIncome: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/income',
    summary: 'Income other than maintenance, for one financial year',
    module: x,
    permission: 'finance.reports.view',
    params: societyParams,
    query: FyQuerySchema,
    response: z.array(IncomeEntrySchema),
  }),
  createIncome: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/income',
    summary: 'Record income like a donation or hall booking',
    module: x,
    permission: 'expense.create',
    params: societyParams,
    body: z
      .object({
        kind: IncomeKindSchema,
        amountPaise: PaiseSchema.min(1).max(1_000_000_000),
        receivedOn: IsoDateSchema,
        description: z.string().trim().max(300).nullable().optional(),
      })
      .strict(),
    response: IncomeEntrySchema,
  }),
  deleteIncome: defineRoute({
    method: 'DELETE',
    path: '/v1/societies/:societyId/income/:incomeId',
    summary: 'Remove an income entry made by mistake',
    module: x,
    permission: 'expense.create',
    params: incomeParams,
    response: OkSchema,
  }),
  report: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/finance/report',
    summary:
      'Financial year summary. Finance roles always; members when the society shares a summary or details.',
    module: x,
    params: societyParams,
    query: FyQuerySchema,
    response: FinanceReportSchema,
  }),
};
