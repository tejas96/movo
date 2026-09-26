import type { RouteDef } from '@movo/contracts';
import { applyDecorators, RequestMapping, RequestMethod, SetMetadata } from '@nestjs/common';

export const ROUTE_META = 'movo:route';

const METHODS = {
  GET: RequestMethod.GET,
  POST: RequestMethod.POST,
  PATCH: RequestMethod.PATCH,
  PUT: RequestMethod.PUT,
  DELETE: RequestMethod.DELETE,
} as const;

/**
 * Binds a handler to a contract. The path, method, auth kind, module and permission all come from
 * the contract, so the API can never drift from what the app expects.
 */
export function Route(def: RouteDef): MethodDecorator {
  return applyDecorators(
    RequestMapping({ path: def.path, method: METHODS[def.method] }),
    SetMetadata(ROUTE_META, def),
  );
}
