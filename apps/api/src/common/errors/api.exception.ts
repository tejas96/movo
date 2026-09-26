import type { ErrorCode } from '@movo/contracts';
import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiException extends HttpException {
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }

  static badRequest(code: ErrorCode, message: string, details?: unknown): ApiException {
    return new ApiException(code, message, HttpStatus.BAD_REQUEST, details);
  }
  static unauthenticated(message = 'Authentication required'): ApiException {
    return new ApiException('UNAUTHENTICATED', message, HttpStatus.UNAUTHORIZED);
  }
  static forbidden(message = 'Not allowed'): ApiException {
    return new ApiException('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
  static notFound(message = 'Not found'): ApiException {
    return new ApiException('NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }
  static conflict(code: ErrorCode, message: string): ApiException {
    return new ApiException(code, message, HttpStatus.CONFLICT);
  }
  static validation(details: unknown): ApiException {
    return new ApiException(
      'VALIDATION_FAILED',
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}
