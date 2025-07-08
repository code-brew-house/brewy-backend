import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

/**
 * Exception filter for rate limiting errors
 * Provides consistent error responses when rate limits are exceeded
 */
@Catch(ThrottlerException)
export class RateLimitExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status = HttpStatus.TOO_MANY_REQUESTS;
    const timestamp = new Date().toISOString();
    const path = request?.url || 'unknown';
    const method = request?.method || 'unknown';
    const ip = request?.ip || 'unknown';

    // Log the rate limit violation for monitoring
    console.warn(
      `[RATE LIMIT EXCEEDED] ${method} ${path} from IP ${ip} at ${timestamp}`,
    );

    // Send consistent error response
    response.status(status).json({
      statusCode: status,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      timestamp,
      path,
      retryAfter: this.getRetryAfterValue(exception),
    });
  }

  /**
   * Extract retry-after value from the exception
   * @param _exception - ThrottlerException containing rate limit details (unused currently)
   * @returns Number of seconds until the user can retry
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getRetryAfterValue(_exception: ThrottlerException): number {
    // Default retry after 60 seconds if we can't determine the exact time
    // In a production system, you might want to extract this from the exception
    // or maintain state about when the rate limit window resets
    return 60;
  }
}
