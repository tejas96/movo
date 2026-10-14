import { z } from 'zod';
import { IdSchema, OkSchema, SocietyParamsSchema } from '../core/common';
import { defineRoute } from '../core/route';
import { ListingReportSchema, ListingSchema } from './market.schemas';
import { listingParams, marketModule, reasonBody } from './shared';

/** Reports and moderation of listings. Part of marketContract. */
export const marketModerationRoutes = {
  reportListing: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/listings/:listingId/report',
    summary: 'Tell the committee a listing breaks the rules',
    module: marketModule,
    params: listingParams,
    body: reasonBody,
    response: OkSchema,
  }),

  listReports: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/market/reports',
    summary: 'Open reports, oldest first',
    module: marketModule,
    permission: 'marketplace.moderate',
    params: SocietyParamsSchema,
    response: z.array(ListingReportSchema),
  }),
  hideListing: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/listings/:listingId/hide',
    summary: 'Take a listing down. Closes its open reports and cancels open orders.',
    module: marketModule,
    permission: 'marketplace.moderate',
    params: listingParams,
    body: reasonBody,
    response: ListingSchema,
  }),
  unhideListing: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/listings/:listingId/unhide',
    summary: 'Bring a hidden listing back as paused',
    module: marketModule,
    permission: 'marketplace.moderate',
    params: listingParams,
    response: ListingSchema,
  }),
  dismissReport: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/reports/:reportId/dismiss',
    summary: 'Close a report without action',
    module: marketModule,
    permission: 'marketplace.moderate',
    params: SocietyParamsSchema.extend({ reportId: IdSchema }),
    response: OkSchema,
  }),
};
