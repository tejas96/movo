import type { RouteDef } from '@movo/contracts';
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import { loadEnv } from '../../config/env';
import { ROUTE_META } from './route.decorator';

/**
 * Outside production, every response is checked against its contract. Drift shows up in tests,
 * not on a resident's phone.
 */
@Injectable()
export class ResponseValidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Contract');
  private readonly enabled = loadEnv().NODE_ENV !== 'production';

  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.enabled) return next.handle();
    const def = this.reflector.get<RouteDef | undefined>(ROUTE_META, ctx.getHandler());
    if (!def) return next.handle();
    return next.handle().pipe(
      map((value) => {
        const result = def.response.safeParse(value);
        if (!result.success) {
          const message = `Response of ${def.method} ${def.path} violates its contract: ${JSON.stringify(result.error.issues.slice(0, 5))}`;
          if (loadEnv().NODE_ENV === 'test') throw new Error(message);
          this.logger.error(message);
        }
        return value;
      }),
    );
  }
}
