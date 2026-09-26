import { z } from 'zod';
import { ActorSchema, IdSchema, IsoDateTimeSchema, OkSchema, PhoneSchema } from '../core/common';
import { defineRoute } from '../core/route';

/** SUGGESTED = added by a member, waiting for the committee. Only APPROVED and TRIAL show to members. */
export const VendorStatusSchema = z.enum(['SUGGESTED', 'APPROVED', 'TRIAL', 'BLOCKED']);
export type VendorStatus = z.infer<typeof VendorStatusSchema>;

/** Icon names the app knows for categories. The app maps each to a design-system icon. */
export const VENDOR_CATEGORY_ICONS = [
  'services',
  'water',
  'electricity',
  'ac',
  'paint',
  'carpentry',
  'tools',
  'cleaning',
  'pest',
  'internet',
  'monitor',
  'mobile',
  'lift',
  'security',
  'gas',
  'laundry',
  'truck',
  'box',
  'flat',
  'key',
  'cctv',
  'lamp',
  'health',
  'cup',
  'bag',
  'people',
] as const;
export const VendorCategoryIconSchema = z.enum(VENDOR_CATEGORY_ICONS);
export type VendorCategoryIcon = z.infer<typeof VendorCategoryIconSchema>;

/** Seeded into every new society. `key` lets the app show the name in the member's language. */
export const DEFAULT_VENDOR_CATEGORIES: readonly {
  key: string;
  name: string;
  icon: VendorCategoryIcon;
}[] = [
  { key: 'plumber', name: 'Plumber', icon: 'water' },
  { key: 'electrician', name: 'Electrician', icon: 'electricity' },
  { key: 'carpenter', name: 'Carpenter', icon: 'carpentry' },
  { key: 'painter', name: 'Painter', icon: 'paint' },
  { key: 'cleaning', name: 'Cleaning', icon: 'cleaning' },
  { key: 'pestControl', name: 'Pest control', icon: 'pest' },
  { key: 'appliance', name: 'AC and appliances', icon: 'ac' },
  { key: 'internet', name: 'Internet and cable', icon: 'internet' },
  { key: 'gas', name: 'Gas', icon: 'gas' },
  { key: 'waterTanker', name: 'Water tanker', icon: 'truck' },
  { key: 'laundry', name: 'Laundry', icon: 'laundry' },
  { key: 'lift', name: 'Lift service', icon: 'lift' },
];

export const VendorCategorySchema = z.object({
  id: IdSchema,
  /** Set for seeded categories. null for ones the committee added. */
  key: z.string().nullable(),
  name: z.string(),
  icon: VendorCategoryIconSchema,
  sortOrder: z.number().int(),
  /** Vendors this viewer can see in the category. */
  vendorCount: z.number().int(),
});
export type VendorCategory = z.infer<typeof VendorCategorySchema>;

export const VendorSchema = z.object({
  id: IdSchema,
  category: z.object({ id: IdSchema, key: z.string().nullable(), name: z.string() }),
  name: z.string(),
  phone: PhoneSchema,
  altPhone: PhoneSchema.nullable(),
  description: z.string().nullable(),
  availability: z.string().nullable(),
  status: VendorStatusSchema,
  /** Only filled for members who can manage vendors. */
  adminNotes: z.string().nullable(),
  addedBy: ActorSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Vendor = z.infer<typeof VendorSchema>;

const societyParams = z.object({ societyId: IdSchema });
const categoryParams = societyParams.extend({ categoryId: IdSchema });
const vendorParams = societyParams.extend({ vendorId: IdSchema });

const CategoryInputSchema = z.object({
  name: z.string().trim().min(2).max(40),
  icon: VendorCategoryIconSchema.default('services'),
});

const VendorInputSchema = z.object({
  categoryId: IdSchema,
  name: z.string().trim().min(2).max(60),
  phone: PhoneSchema,
  altPhone: PhoneSchema.nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  availability: z.string().trim().max(100).nullable().optional(),
  /** Ignored for members without vendor.manage: their additions are SUGGESTED. */
  status: VendorStatusSchema.exclude(['SUGGESTED']).optional(),
  adminNotes: z.string().trim().max(500).nullable().optional(),
});

export const vendorsContract = {
  listCategories: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/vendor-categories',
    summary: 'Service categories with vendor counts',
    module: 'vendors',
    params: societyParams,
    response: z.array(VendorCategorySchema),
  }),
  createCategory: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/vendor-categories',
    summary: 'Add a category',
    module: 'vendors',
    permission: 'vendor.manage',
    params: societyParams,
    body: CategoryInputSchema.strict(),
    response: VendorCategorySchema,
  }),
  updateCategory: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/vendor-categories/:categoryId',
    summary: 'Rename, re-icon or reorder a category',
    module: 'vendors',
    permission: 'vendor.manage',
    params: categoryParams,
    body: CategoryInputSchema.partial()
      .extend({ sortOrder: z.number().int().min(0).max(1000).optional() })
      .strict(),
    response: VendorCategorySchema,
  }),
  deleteCategory: defineRoute({
    method: 'DELETE',
    path: '/v1/societies/:societyId/vendor-categories/:categoryId',
    summary: 'Delete an empty category',
    module: 'vendors',
    permission: 'vendor.manage',
    params: categoryParams,
    response: OkSchema,
  }),

  list: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/vendors',
    summary:
      'Vendors. Members see approved and trial ones plus their own suggestions. Managers see all.',
    module: 'vendors',
    params: societyParams,
    query: z.object({
      categoryId: IdSchema.optional(),
      q: z.string().trim().max(60).optional(),
      status: VendorStatusSchema.optional(),
    }),
    response: z.array(VendorSchema),
  }),
  get: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/vendors/:vendorId',
    summary: 'One vendor',
    module: 'vendors',
    params: vendorParams,
    response: VendorSchema,
  }),
  create: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/vendors',
    summary:
      'Add a vendor. Managers add it directly. Members suggest one when the society allows it.',
    module: 'vendors',
    params: societyParams,
    body: VendorInputSchema.strict(),
    response: VendorSchema,
  }),
  update: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/vendors/:vendorId',
    summary: 'Edit a vendor, approve a suggestion, or block one',
    module: 'vendors',
    permission: 'vendor.manage',
    params: vendorParams,
    body: VendorInputSchema.partial().strict(),
    response: VendorSchema,
  }),
  remove: defineRoute({
    method: 'DELETE',
    path: '/v1/societies/:societyId/vendors/:vendorId',
    summary: 'Delete a vendor, usually a rejected suggestion. Block instead to keep history.',
    module: 'vendors',
    permission: 'vendor.manage',
    params: vendorParams,
    response: OkSchema,
  }),
};
