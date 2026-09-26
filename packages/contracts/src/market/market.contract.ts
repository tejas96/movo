import { z } from 'zod';
import {
  CursorQuerySchema,
  IdSchema,
  IsoDateTimeSchema,
  OkSchema,
  PaiseSchema,
  PhoneSchema,
  page,
} from '../core/common';
import { defineRoute } from '../core/route';

/** FOOD = homemade food and tiffin. PRODUCT = handmade or small-batch goods. RESALE = used items. */
export const ListingKindSchema = z.enum(['FOOD', 'PRODUCT', 'SERVICE', 'RESALE']);
export type ListingKind = z.infer<typeof ListingKindSchema>;

/** The green dot, the brown dot, and egg. Required on food. */
export const DietSchema = z.enum(['VEG', 'EGG', 'NON_VEG']);
export type Diet = z.infer<typeof DietSchema>;

export const PriceTypeSchema = z.enum(['FIXED', 'PER_UNIT', 'NEGOTIABLE', 'FREE']);
export type PriceType = z.infer<typeof PriceTypeSchema>;

/** Delivery means to the buyer's door inside the society. */
export const FulfilmentSchema = z.enum(['PICKUP', 'DELIVERY', 'BOTH']);
export type Fulfilment = z.infer<typeof FulfilmentSchema>;
export const OrderFulfilmentSchema = z.enum(['PICKUP', 'DELIVERY']);
export type OrderFulfilment = z.infer<typeof OrderFulfilmentSchema>;

export const ItemConditionSchema = z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']);
export type ItemCondition = z.infer<typeof ItemConditionSchema>;

/** HIDDEN = taken down by a moderator. Only a moderator can bring it back. */
export const ListingStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED', 'HIDDEN']);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

/** SOCIETY = my society only. NETWORK = nearby MOVO societies too, when the society allows it. */
export const ListingVisibilitySchema = z.enum(['SOCIETY', 'NETWORK']);
export type ListingVisibility = z.infer<typeof ListingVisibilitySchema>;

export const OrderStatusSchema = z.enum([
  'REQUESTED',
  'ACCEPTED',
  'REJECTED',
  'READY',
  'COMPLETED',
  'CANCELLED',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderRoleSchema = z.enum(['BUYING', 'SELLING']);
export type OrderRole = z.infer<typeof OrderRoleSchema>;

/**
 * A stored photo. The url is a signed path on the API ("/v1/files/<id>?e=..&s=..") that works
 * for at least an hour without a login. The app puts API_URL in front of it.
 */
export const FileRefSchema = z.object({ id: IdSchema, url: z.string() });
export type FileRef = z.infer<typeof FileRefSchema>;

export const RatingSchema = z.object({
  average: z.number(),
  count: z.number().int(),
});

export const ListingSummarySchema = z.object({
  id: IdSchema,
  kind: ListingKindSchema,
  title: z.string(),
  priceType: PriceTypeSchema,
  /** null when FREE, or NEGOTIABLE with no asking price. */
  pricePaise: PaiseSchema.nullable(),
  /** "plate", "kg", "hour". Only for PER_UNIT. */
  unit: z.string().nullable(),
  diet: DietSchema.nullable(),
  cover: FileRefSchema.nullable(),
  seller: z.object({ membershipId: IdSchema, displayName: z.string() }),
  rating: RatingSchema.nullable(),
  /** null = no limit. */
  quantityAvailable: z.number().int().nullable(),
  soldOut: z.boolean(),
  /** Food: when it is ready. */
  readyAt: IsoDateTimeSchema.nullable(),
  /** Food: last time to order. */
  orderBy: IsoDateTimeSchema.nullable(),
  /** orderBy has passed. */
  ordersClosed: z.boolean(),
  status: ListingStatusSchema,
  isMine: z.boolean(),
  createdAt: IsoDateTimeSchema,
});
export type ListingSummary = z.infer<typeof ListingSummarySchema>;

export const ReviewSchema = z.object({
  id: IdSchema,
  rating: z.number().int().min(1).max(5),
  text: z.string().nullable(),
  by: z.string(),
  createdAt: IsoDateTimeSchema,
});
export type Review = z.infer<typeof ReviewSchema>;

export const ListingSchema = ListingSummarySchema.extend({
  description: z.string().nullable(),
  images: z.array(FileRefSchema),
  fulfilment: FulfilmentSchema,
  condition: ItemConditionSchema.nullable(),
  visibility: ListingVisibilitySchema,
  showPhoneAfterAccept: z.boolean(),
  /** Newest first, at most 10. */
  reviews: z.array(ReviewSchema),
  /** An order of mine on this listing that is not finished yet. */
  myOpenOrderId: IdSchema.nullable(),
  /** Set for the seller and moderators when a moderator hid it. */
  hiddenReason: z.string().nullable(),
  canOrder: z.boolean(),
  canEdit: z.boolean(),
  canModerate: z.boolean(),
});
export type Listing = z.infer<typeof ListingSchema>;

const ListingInputSchema = z
  .object({
    kind: ListingKindSchema,
    title: z.string().trim().min(2).max(80),
    description: z.string().trim().max(2000).nullable().optional(),
    priceType: PriceTypeSchema,
    pricePaise: PaiseSchema.max(100_000_000).nullable().optional(),
    unit: z.string().trim().min(1).max(20).nullable().optional(),
    diet: DietSchema.nullable().optional(),
    quantityAvailable: z.number().int().min(0).max(10_000).nullable().optional(),
    readyAt: IsoDateTimeSchema.nullable().optional(),
    orderBy: IsoDateTimeSchema.nullable().optional(),
    fulfilment: FulfilmentSchema.default('PICKUP'),
    condition: ItemConditionSchema.nullable().optional(),
    /** Up to 5 photos, first one is the cover. Upload them first. */
    imageIds: z.array(IdSchema).max(5).default([]),
    visibility: ListingVisibilitySchema.default('SOCIETY'),
    showPhoneAfterAccept: z.boolean().default(false),
  })
  .strict();

export const OrderPartySchema = z.object({
  membershipId: IdSchema,
  displayName: z.string(),
  /** Shown once the order is accepted, so they can find each other. */
  flat: z.string().nullable(),
  /** The seller's phone, only when they chose to share it and the order is accepted. */
  phone: PhoneSchema.nullable(),
});

export const OrderMessageSchema = z.object({
  id: IdSchema,
  body: z.string(),
  mine: z.boolean(),
  by: z.string(),
  createdAt: IsoDateTimeSchema,
});
export type OrderMessage = z.infer<typeof OrderMessageSchema>;

export const OrderSummarySchema = z.object({
  id: IdSchema,
  listing: z.object({
    id: IdSchema,
    kind: ListingKindSchema,
    title: z.string(),
    cover: FileRefSchema.nullable(),
    unit: z.string().nullable(),
  }),
  role: OrderRoleSchema,
  /** The other person. */
  counterpart: z.object({ membershipId: IdSchema, displayName: z.string() }),
  quantity: z.number().int(),
  /** null when the price is FREE or NEGOTIABLE with no asking price. */
  totalPaise: PaiseSchema.nullable(),
  fulfilment: OrderFulfilmentSchema,
  status: OrderStatusSchema,
  unreadMessages: z.number().int(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type OrderSummary = z.infer<typeof OrderSummarySchema>;

export const OrderSchema = OrderSummarySchema.extend({
  buyer: OrderPartySchema,
  seller: OrderPartySchema,
  note: z.string().nullable(),
  /** Why it was rejected or cancelled. */
  reason: z.string().nullable(),
  readyAt: IsoDateTimeSchema.nullable(),
  messages: z.array(OrderMessageSchema),
  review: ReviewSchema.nullable(),
  canAccept: z.boolean(),
  canReject: z.boolean(),
  canMarkReady: z.boolean(),
  canComplete: z.boolean(),
  canCancel: z.boolean(),
  canMessage: z.boolean(),
  canReview: z.boolean(),
});
export type Order = z.infer<typeof OrderSchema>;

export const ListingReportSchema = z.object({
  id: IdSchema,
  listing: ListingSummarySchema,
  reason: z.string(),
  reportedBy: z.string(),
  createdAt: IsoDateTimeSchema,
});
export type ListingReport = z.infer<typeof ListingReportSchema>;

const societyParams = z.object({ societyId: IdSchema });
const listingParams = societyParams.extend({ listingId: IdSchema });
const orderParams = societyParams.extend({ orderId: IdSchema });
const m = 'marketplace' as const;
const reasonBody = z.object({ reason: z.string().trim().min(2).max(300) }).strict();
const optionalReasonBody = z.object({ reason: z.string().trim().max(300).optional() }).strict();

export const marketContract = {
  listListings: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/market/listings',
    summary: 'Active listings in this society, newest first. Sold out ones come last.',
    module: m,
    params: societyParams,
    query: CursorQuerySchema.extend({
      kind: ListingKindSchema.optional(),
      q: z.string().trim().max(60).optional(),
    }),
    response: page(ListingSummarySchema),
  }),
  myListings: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/market/my-listings',
    summary: 'My listings in every status except archived',
    module: m,
    params: societyParams,
    response: z.array(ListingSummarySchema),
  }),
  getListing: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/market/listings/:listingId',
    summary: 'One listing with photos and reviews',
    module: m,
    params: listingParams,
    response: ListingSchema,
  }),
  createListing: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/listings',
    summary: 'Sell something. Food needs a diet mark.',
    module: m,
    params: societyParams,
    body: ListingInputSchema,
    response: ListingSchema,
  }),
  updateListing: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/market/listings/:listingId',
    summary: 'Edit my listing',
    module: m,
    params: listingParams,
    body: ListingInputSchema.partial().strict(),
    response: ListingSchema,
  }),
  setListingStatus: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/listings/:listingId/status',
    summary: 'Pause, resume or archive my listing',
    module: m,
    params: listingParams,
    body: z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']) }).strict(),
    response: ListingSchema,
  }),
  reportListing: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/listings/:listingId/report',
    summary: 'Tell the committee a listing breaks the rules',
    module: m,
    params: listingParams,
    body: reasonBody,
    response: OkSchema,
  }),

  listReports: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/market/reports',
    summary: 'Open reports, oldest first',
    module: m,
    permission: 'marketplace.moderate',
    params: societyParams,
    response: z.array(ListingReportSchema),
  }),
  hideListing: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/listings/:listingId/hide',
    summary: 'Take a listing down. Closes its open reports and cancels open orders.',
    module: m,
    permission: 'marketplace.moderate',
    params: listingParams,
    body: reasonBody,
    response: ListingSchema,
  }),
  unhideListing: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/listings/:listingId/unhide',
    summary: 'Bring a hidden listing back as paused',
    module: m,
    permission: 'marketplace.moderate',
    params: listingParams,
    response: ListingSchema,
  }),
  dismissReport: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/reports/:reportId/dismiss',
    summary: 'Close a report without action',
    module: m,
    permission: 'marketplace.moderate',
    params: societyParams.extend({ reportId: IdSchema }),
    response: OkSchema,
  }),

  createOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/listings/:listingId/orders',
    summary: 'Ask the seller for this. Nothing is paid in the app.',
    module: m,
    params: listingParams,
    body: z
      .object({
        quantity: z.number().int().min(1).max(100).default(1),
        fulfilment: OrderFulfilmentSchema.default('PICKUP'),
        note: z.string().trim().max(300).nullable().optional(),
      })
      .strict(),
    response: OrderSchema,
  }),
  listOrders: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/market/orders',
    summary: 'My orders as buyer or seller. Open ones first.',
    module: m,
    params: societyParams,
    query: z.object({ role: OrderRoleSchema.default('BUYING') }),
    response: z.array(OrderSummarySchema),
  }),
  getOrder: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/market/orders/:orderId',
    summary: 'One order with its messages. Reading it marks the messages read.',
    module: m,
    params: orderParams,
    response: OrderSchema,
  }),
  acceptOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/accept',
    summary: 'Seller accepts. Takes the quantity from what is available.',
    module: m,
    params: orderParams,
    response: OrderSchema,
  }),
  rejectOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/reject',
    summary: 'Seller says no',
    module: m,
    params: orderParams,
    body: optionalReasonBody,
    response: OrderSchema,
  }),
  markOrderReady: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/ready',
    summary: 'Seller: ready for pickup or on the way',
    module: m,
    params: orderParams,
    response: OrderSchema,
  }),
  completeOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/complete',
    summary: 'Either side: handed over and paid',
    module: m,
    params: orderParams,
    response: OrderSchema,
  }),
  cancelOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/cancel',
    summary: 'Buyer before it is ready, or seller after accepting. Gives the quantity back.',
    module: m,
    params: orderParams,
    body: optionalReasonBody,
    response: OrderSchema,
  }),
  sendMessage: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/messages',
    summary: 'Short message to the other side of the order',
    module: m,
    params: orderParams,
    body: z.object({ body: z.string().trim().min(1).max(500) }).strict(),
    response: OrderSchema,
  }),
  reviewOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/review',
    summary: 'Buyer rates a completed order, once',
    module: m,
    params: orderParams,
    body: z
      .object({
        rating: z.number().int().min(1).max(5),
        text: z.string().trim().max(500).nullable().optional(),
      })
      .strict(),
    response: OrderSchema,
  }),
};

/** Upload is multipart/form-data with one field "file". The app calls it with fetch + FormData. */
export const FILE_UPLOAD_PATH = '/v1/societies/:societyId/files';
export const FILE_MAX_BYTES = 5 * 1024 * 1024;
export const FILE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const filesContract = {
  upload: defineRoute({
    method: 'POST',
    path: FILE_UPLOAD_PATH,
    summary: 'Upload one photo (JPEG, PNG or WebP, 5 MB at most). Unused uploads go after a day.',
    params: societyParams,
    response: FileRefSchema,
  }),
};
