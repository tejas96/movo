import type { RouteDef, RouteInput } from '@movo/contracts';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApiException } from '../errors/api.exception';

/** Validates params, query and body against the contract and hands the handler one typed object. */
export function parseInput<T extends RouteDef>(def: T, req: Request): RouteInput<T> {
  const issues: unknown[] = [];
  const params = def.params.safeParse(req.params ?? {});
  const query = def.query.safeParse(req.query ?? {});
  const body = def.body.safeParse(req.body ?? {});
  if (!params.success) issues.push(...params.error.issues.map((i) => ({ ...i, in: 'params' })));
  if (!query.success) issues.push(...query.error.issues.map((i) => ({ ...i, in: 'query' })));
  if (!body.success) issues.push(...body.error.issues.map((i) => ({ ...i, in: 'body' })));
  if (issues.length) throw ApiException.validation(issues);
  return { params: params.data, query: query.data, body: body.data } as RouteInput<T>;
}

export const Input = createParamDecorator((def: RouteDef, ctx: ExecutionContext) =>
  parseInput(def, ctx.switchToHttp().getRequest<Request>()),
);
