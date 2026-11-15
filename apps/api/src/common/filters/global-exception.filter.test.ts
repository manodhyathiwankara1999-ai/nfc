import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter';

function createHost() {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'request-123' }),
      getResponse: () => response,
    }),
  } as ArgumentsHost;
  const logger = {
    setContext: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };
  return { filter: new GlobalExceptionFilter(logger as never), host, response, logger };
}

describe('GlobalExceptionFilter', () => {
  it('returns safe service-unavailable messages to the client', () => {
    const { filter, host, response } = createHost();

    filter.catch(
      new HttpException('Email delivery is not configured.', HttpStatus.SERVICE_UNAVAILABLE),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'HTTP_503',
      message: 'Email delivery is not configured.',
      requestId: 'request-123',
    });
  });

  it('preserves a validated typed error code from an HTTP exception', () => {
    const { filter, host, response } = createHost();

    filter.catch(
      new HttpException(
        {
          code: 'STORAGE_NOT_CONFIGURED',
          message: 'Image storage is not configured. Please contact support.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      ),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'STORAGE_NOT_CONFIGURED',
      message: 'Image storage is not configured. Please contact support.',
      requestId: 'request-123',
    });
  });

  it('keeps unexpected server errors generic', () => {
    const { filter, host, response } = createHost();

    filter.catch(new Error('Internal database details'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'HTTP_500',
      message: 'An unexpected error occurred.',
      requestId: 'request-123',
    });
  });

  it('logs safe error metadata without exposing the exception message', () => {
    const { filter, host, logger } = createHost();
    const error = Object.assign(new Error('Database connection string contains credentials'), {
      code: 'P1001',
    });

    filter.catch(error, host);

    expect(logger.error).toHaveBeenCalledWith(
      {
        requestId: 'request-123',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'HTTP_500',
        errorName: 'Error',
        errorCode: 'P1001',
      },
      'Unhandled API exception',
    );
  });

  it('does not log unvalidated error codes', () => {
    const { filter, host, logger } = createHost();
    const error = Object.assign(new Error('Internal database details'), {
      code: 'internal database details',
    });

    filter.catch(error, host);

    expect(logger.error).toHaveBeenCalledWith(
      {
        requestId: 'request-123',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'HTTP_500',
        errorName: 'Error',
      },
      'Unhandled API exception',
    );
  });
});
