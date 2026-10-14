import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, PaiseSchema, PhoneSchema } from '../core/common';
import { FileRefSchema } from '../files/files.contract';

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
