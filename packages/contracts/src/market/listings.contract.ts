import { z } from 'zod';
import {
  CursorQuerySchema,
  IdSchema,
  IsoDateTimeSchema,
  PaiseSchema,
  page,
  SocietyParamsSchema,
} from '../core/common';
import { defineRoute } from '../core/route';
import { MAX_LISTING_PHOTOS } from '../files/files.contract';
import {
  DietSchema,
  FulfilmentSchema,
  ItemConditionSchema,
  ListingKindSchema,
  ListingSchema,
  ListingSummarySchema,
  ListingVisibilitySchema,
  PriceTypeSchema,
} from './market.schemas';
import { listingParams, marketModule } from './shared';

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
    imageIds: z.array(IdSchema).max(MAX_LISTING_PHOTOS).default([]),
    visibility: ListingVisibilitySchema.default('SOCIETY'),
    showPhoneAfterAccept: z.boolean().default(false),
  })
  .strict();

/** Listings: browse, create, edit. Part of marketContract. */
export const marketListingRoutes = {
  listListings: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/market/listings',
    summary: 'Active listings in this society, newest first. Sold out ones come last.',
    module: marketModule,
    params: SocietyParamsSchema,
    query: CursorQuerySchema.extend({
      kind: ListingKindSchema.optional(),
      q: z.string().trim().max(60).optional(),
    }),
    response: page(ListingSummarySchema),
  }),
  myListings: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/market/my-listings',
    summary: 'My listings in every status except archived',
    module: marketModule,
    params: SocietyParamsSchema,
    response: z.array(ListingSummarySchema),
  }),
  getListing: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/market/listings/:listingId',
    summary: 'One listing with photos and reviews',
    module: marketModule,
    params: listingParams,
    response: ListingSchema,
  }),
  createListing: defineRoute({
    method: 'POST',
    path: '/societies/:societyId/market/listings',
    summary: 'Sell something. Food needs a diet mark.',
    module: marketModule,
    params: SocietyParamsSchema,
    body: ListingInputSchema,
    response: ListingSchema,
  }),
  updateListing: defineRoute({
    method: 'PATCH',
    path: '/societies/:societyId/market/listings/:listingId',
    summary: 'Edit my listing',
    module: marketModule,
    params: listingParams,
    body: ListingInputSchema.partial().strict(),
    response: ListingSchema,
  }),
  setListingStatus: defineRoute({
    method: 'POST',
    path: '/societies/:societyId/market/listings/:listingId/status',
    summary: 'Pause, resume or archive my listing',
    module: marketModule,
    params: listingParams,
    body: z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']) }).strict(),
    response: ListingSchema,
  }),
};
