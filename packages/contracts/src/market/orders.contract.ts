import { z } from 'zod';
import { SocietyParamsSchema } from '../core/common';
import { defineRoute } from '../core/route';
import {
  OrderFulfilmentSchema,
  OrderRoleSchema,
  OrderSchema,
  OrderSummarySchema,
} from './market.schemas';
import { listingParams, marketModule, optionalReasonBody, orderParams } from './shared';

/** Orders, order chat and reviews. Part of marketContract. */
export const marketOrderRoutes = {
  createOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/listings/:listingId/orders',
    summary: 'Ask the seller for this. Nothing is paid in the app.',
    module: marketModule,
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
    module: marketModule,
    params: SocietyParamsSchema,
    query: z.object({ role: OrderRoleSchema.default('BUYING') }),
    response: z.array(OrderSummarySchema),
  }),
  getOrder: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/market/orders/:orderId',
    summary: 'One order with its messages. Reading it marks the messages read.',
    module: marketModule,
    params: orderParams,
    response: OrderSchema,
  }),
  acceptOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/accept',
    summary: 'Seller accepts. Takes the quantity from what is available.',
    module: marketModule,
    params: orderParams,
    response: OrderSchema,
  }),
  rejectOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/reject',
    summary: 'Seller says no',
    module: marketModule,
    params: orderParams,
    body: optionalReasonBody,
    response: OrderSchema,
  }),
  markOrderReady: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/ready',
    summary: 'Seller: ready for pickup or on the way',
    module: marketModule,
    params: orderParams,
    response: OrderSchema,
  }),
  completeOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/complete',
    summary: 'Either side: handed over and paid',
    module: marketModule,
    params: orderParams,
    response: OrderSchema,
  }),
  cancelOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/cancel',
    summary: 'Buyer before it is ready, or seller after accepting. Gives the quantity back.',
    module: marketModule,
    params: orderParams,
    body: optionalReasonBody,
    response: OrderSchema,
  }),
  sendMessage: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/messages',
    summary: 'Short message to the other side of the order',
    module: marketModule,
    params: orderParams,
    body: z.object({ body: z.string().trim().min(1).max(500) }).strict(),
    response: OrderSchema,
  }),
  reviewOrder: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/market/orders/:orderId/review',
    summary: 'Buyer rates a completed order, once',
    module: marketModule,
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
