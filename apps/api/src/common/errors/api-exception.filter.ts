import type { ApiError } from '@movo/contracts';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { getStore } from '../request-store';
import { ApiException } from './api.exception';

/** Every error leaves the API in the same shape: { code, message, details?, requestId }. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = getStore()?.requestId;
    const { status, body } = this.translate(exception);
    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }
    res.status(status).json({ ...body, requestId });
  }

  private translate(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof ApiException) {
      return {
        status: exception.getStatus(),
        body: { code: exception.code, message: exception.message, details: exception.details },
      };
    }
    if (exception instanceof ZodError) {
      return {
        status: 400,
        body: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: exception.issues,
        },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code =
        status === 401
          ? 'UNAUTHENTICATED'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : status === 429
                ? 'RATE_LIMITED'
                : status === 409
                  ? 'CONFLICT'
                  : status >= 500
                    ? 'INTERNAL'
                    : 'VALIDATION_FAILED';
      return {
        status,
        body: { code, message: status >= 500 ? 'Internal error' : exception.message },
      };
    }
    // Prisma unique constraint
    if (
      typeof exception === 'object' &&
      exception &&
      (exception as { code?: string }).code === 'P2002'
    ) {
      return { status: 409, body: { code: 'CONFLICT', message: 'Already exists' } };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL', message: 'Internal error' },
    };
  }
}
