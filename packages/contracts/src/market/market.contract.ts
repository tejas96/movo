import { marketListingRoutes } from './listings.contract';
import { marketModerationRoutes } from './moderation.contract';
import { marketOrderRoutes } from './orders.contract';

export * from './market.schemas';

/** Every market route. The parts live in one file per area; keys and order are unchanged. */
export const marketContract = {
  ...marketListingRoutes,
  ...marketModerationRoutes,
  ...marketOrderRoutes,
};
