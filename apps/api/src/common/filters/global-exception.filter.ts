import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { Request, Response } from 'express';

interface RequestWithId extends Request {
  id: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const requestId = request.id;
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = this.getPublicCode(exception, statusCode);
    const message =
      exception instanceof HttpException && statusCode === HttpStatus.SERVICE_UNAVAILABLE
        ? this.getPublicMessage(exception)
        : statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'An unexpected error occurred.'
          : exception instanceof HttpException && statusCode !== HttpStatus.BAD_REQUEST
            ? this.getPublicMessage(exception)
            : statusCode === HttpStatus.BAD_REQUEST
              ? 'Request validation failed.'
              : 'The request could not be completed.';

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { requestId, statusCode, code, ...this.getSafeErrorMetadata(exception) },
        'Unhandled API exception',
      );
    } else {
      this.logger.warn({ requestId, statusCode, code }, 'API request rejected');
    }

    response.status(statusCode).json({ statusCode, code, message, requestId });
  }

  private getSafeErrorMetadata(exception: unknown): {
    errorName?: string;
    errorCode?: string;
  } {
    if (!(exception instanceof Error)) return {};
    const errorCode =
      'code' in exception &&
      typeof exception.code === 'string' &&
      /^[A-Z][A-Z0-9_]{1,31}$/.test(exception.code)
        ? exception.code
        : undefined;
    return {
      errorName: exception.name,
      ...(errorCode ? { errorCode } : {}),
    };
  }

  private getPublicCode(exception: unknown, statusCode: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (
        typeof response === 'object' &&
        response !== null &&
        'code' in response &&
        typeof response.code === 'string' &&
        /^[A-Z][A-Z0-9_]{1,63}$/.test(response.code)
      ) {
        return response.code;
      }
    }
    if (statusCode === HttpStatus.NOT_IMPLEMENTED) return 'NOT_IMPLEMENTED';
    if (statusCode === HttpStatus.BAD_REQUEST) return 'VALIDATION_ERROR';
    return `HTTP_${statusCode}`;
  }

  private getPublicMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const value = response.message;
      if (typeof value === 'string') return value;
    }
    return 'The request could not be completed.';
  }
}
