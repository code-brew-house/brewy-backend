import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { SecurityLoggerService } from '../services/security-logger.service';

/**
 * Interface for request logging data
 */
export interface RequestLogData {
  method: string;
  url: string;
  userAgent: string;
  ip: string;
  userId?: string;
  username?: string;
  timestamp: Date;
  headers?: Record<string, string>;
  query?: Record<string, any>;
  body?: Record<string, any>;
  requestId?: string;
}

/**
 * Interface for response logging data
 */
export interface ResponseLogData {
  statusCode: number;
  responseTime: number;
  responseSize?: number;
  timestamp: Date;
  requestId?: string;
}

/**
 * Comprehensive logging interceptor for request/response monitoring
 * Captures detailed information for security analysis and performance monitoring
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  constructor(private readonly securityLogger: SecurityLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Generate unique request ID for correlation
    const requestId = this.generateRequestId();

    // Extract user information from JWT token if available
    const user = request.user as any;

    // Prepare request log data
    const requestLogData: RequestLogData = {
      method: request.method,
      url: request.url,
      userAgent: request.get('User-Agent') || 'unknown',
      ip: this.getClientIp(request),
      userId: user?.id,
      username: user?.username,
      timestamp: new Date(),
      headers: this.sanitizeHeaders(request.headers),
      query: request.query,
      body: this.sanitizeBody(request.body),
      requestId,
    };

    // Log incoming request
    this.logRequest(requestLogData);

    return next.handle().pipe(
      tap((data) => {
        // Log successful response
        const responseTime = Date.now() - now;
        const responseLogData: ResponseLogData = {
          statusCode: response.statusCode,
          responseTime,
          responseSize: this.calculateResponseSize(data),
          timestamp: new Date(),
          requestId,
        };

        this.logResponse(requestLogData, responseLogData, null);
      }),
      catchError((error) => {
        // Log error response
        const responseTime = Date.now() - now;
        const responseLogData: ResponseLogData = {
          statusCode: error.status || 500,
          responseTime,
          timestamp: new Date(),
          requestId,
        };

        this.logResponse(requestLogData, responseLogData, error);

        // Re-throw the error
        throw error;
      }),
    );
  }

  /**
   * Log incoming request details
   */
  private logRequest(data: RequestLogData): void {
    const logMessage = `${data.method} ${data.url} - ${data.ip} - ${data.userAgent}`;

    // Log basic request info
    this.logger.log(`[REQUEST] ${logMessage}`, {
      requestId: data.requestId,
      method: data.method,
      url: data.url,
      ip: data.ip,
      userAgent: data.userAgent,
      userId: data.userId,
      username: data.username,
      timestamp: data.timestamp,
    });

    // Log detailed request for sensitive endpoints
    if (this.isSensitiveEndpoint(data.url)) {
      this.logger.debug(`[REQUEST-DETAILED] ${logMessage}`, {
        requestId: data.requestId,
        headers: data.headers,
        query: data.query,
        body: data.body,
      });
    }
  }

  /**
   * Log response details
   */
  private logResponse(
    requestData: RequestLogData,
    responseData: ResponseLogData,
    error: any,
  ): void {
    const logMessage = `${requestData.method} ${requestData.url} - ${responseData.statusCode} - ${responseData.responseTime}ms`;

    if (error) {
      // Log error responses
      this.logger.error(`[RESPONSE-ERROR] ${logMessage}`, {
        requestId: responseData.requestId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          status: error.status,
        },
        request: {
          method: requestData.method,
          url: requestData.url,
          ip: requestData.ip,
          userAgent: requestData.userAgent,
          userId: requestData.userId,
          username: requestData.username,
        },
        response: responseData,
      });

      // Log security events for specific error types
      if (responseData.statusCode === 401) {
        this.securityLogger.logUnauthorizedAccess(
          requestData.url,
          requestData.method,
          requestData.ip,
          requestData.userAgent,
          error.message || 'Unauthorized access attempt',
        );
      } else if (responseData.statusCode === 403) {
        this.securityLogger.logSecurityEvent({
          type: 'FORBIDDEN_ACCESS' as any,
          severity: 'HIGH' as any,
          userId: requestData.userId,
          username: requestData.username,
          ipAddress: requestData.ip,
          userAgent: requestData.userAgent,
          endpoint: requestData.url,
          method: requestData.method,
          message: `Forbidden access attempt to ${requestData.method} ${requestData.url}`,
          timestamp: new Date(),
        });
      } else if (responseData.statusCode >= 500) {
        this.logger.error(`[SERVER-ERROR] ${logMessage}`, {
          requestId: responseData.requestId,
          error: error.stack,
        });
      }
    } else {
      // Log successful responses
      const logLevel = this.getLogLevel(
        responseData.statusCode,
        responseData.responseTime,
      );
      const logData = {
        requestId: responseData.requestId,
        statusCode: responseData.statusCode,
        responseTime: responseData.responseTime,
        responseSize: responseData.responseSize,
        userId: requestData.userId,
        username: requestData.username,
      };

      if (logLevel === 'warn') {
        this.logger.warn(`[RESPONSE-SLOW] ${logMessage}`, logData);
      } else {
        this.logger.log(`[RESPONSE] ${logMessage}`, logData);
      }

      // Log successful access to protected routes
      if (requestData.userId && this.isProtectedEndpoint(requestData.url)) {
        this.securityLogger.logSecurityEvent({
          type: 'PROTECTED_ROUTE_ACCESS' as any,
          severity: 'LOW' as any,
          userId: requestData.userId,
          username: requestData.username,
          ipAddress: requestData.ip,
          userAgent: requestData.userAgent,
          endpoint: requestData.url,
          method: requestData.method,
          message: `Protected route accessed: ${requestData.method} ${requestData.url}`,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Generate unique request ID for correlation
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get client IP address with proxy support
   */
  private getClientIp(request: Request): string {
    return (
      request.ip ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      'unknown'
    );
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(
    headers: Record<string, any>,
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body: any): Record<string, any> {
    if (!body || typeof body !== 'object') {
      return {};
    }

    const sanitized: Record<string, any> = {};
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey'];

    for (const [key, value] of Object.entries(body)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Calculate response size in bytes
   */
  private calculateResponseSize(data: any): number {
    if (!data) return 0;

    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  /**
   * Check if endpoint is sensitive and requires detailed logging
   */
  private isSensitiveEndpoint(url: string): boolean {
    const sensitivePatterns = [
      '/auth/',
      '/login',
      '/register',
      '/password',
      '/admin',
      '/users',
    ];

    return sensitivePatterns.some((pattern) => url.includes(pattern));
  }

  /**
   * Check if endpoint is protected and requires authentication
   */
  private isProtectedEndpoint(url: string): boolean {
    const protectedPatterns = [
      '/users/profile',
      '/admin/',
      '/dashboard',
      '/protected',
    ];

    return protectedPatterns.some((pattern) => url.includes(pattern));
  }

  /**
   * Determine log level based on response code and time
   */
  private getLogLevel(
    statusCode: number,
    responseTime: number,
  ): 'log' | 'warn' | 'error' {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    if (responseTime > 1000) return 'warn'; // Responses slower than 1 second
    return 'log';
  }
}
