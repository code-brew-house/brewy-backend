import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Exception filter for authentication and authorization errors
 * Provides consistent error responses for authentication failures
 */
@Catch(UnauthorizedException, ForbiddenException)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(
    exception: UnauthorizedException | ForbiddenException,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status = exception.getStatus();
    const timestamp = new Date().toISOString();
    const path = request?.url || 'unknown';
    const method = request?.method || 'unknown';
    const ip = request?.ip || 'unknown';
    const userAgent = request?.headers?.['user-agent'] || 'unknown';

    // Log the authentication failure for security monitoring
    console.warn(
      `[AUTH FAILURE] ${method} ${path} from IP ${ip} at ${timestamp} - ${exception.message}`,
    );

    // Determine the appropriate error message based on exception type
    const errorResponse = this.getErrorResponse(exception, status);

    // Send consistent error response without revealing sensitive information
    response.status(status).json({
      statusCode: status,
      error: errorResponse.error,
      message: errorResponse.message,
      timestamp,
      path,
      // Additional security headers for monitoring
      requestId: this.generateRequestId(),
    });

    // Log additional details for security monitoring (not sent to client)
    console.warn(
      `[AUTH DETAILS] User-Agent: ${userAgent}, Request ID: ${this.generateRequestId()}`,
    );
  }

  /**
   * Get appropriate error response based on exception type
   * @param exception - The authentication exception
   * @param status - HTTP status code
   * @returns Error response object
   */
  private getErrorResponse(
    exception: UnauthorizedException | ForbiddenException,
    status: number,
  ): { error: string; message: string } {
    if (status === HttpStatus.UNAUTHORIZED) {
      return {
        error: 'Unauthorized',
        message: 'Authentication required. Please provide valid credentials.',
      };
    } else if (status === HttpStatus.FORBIDDEN) {
      return {
        error: 'Forbidden',
        message:
          'Access denied. You do not have permission to access this resource.',
      };
    }

    // Fallback for other authentication-related errors
    return {
      error: 'Authentication Error',
      message: 'Authentication failed. Please try again.',
    };
  }

  /**
   * Generate a unique request ID for tracking purposes
   * @returns Unique request identifier
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
