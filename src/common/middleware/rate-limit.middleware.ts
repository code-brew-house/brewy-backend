import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SecurityLoggerService } from '../services/security-logger.service';

/**
 * Custom rate limiting middleware that extends ThrottlerGuard
 * Provides enhanced IP tracking and handles requests behind proxy servers
 */
@Injectable()
export class RateLimitMiddleware extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    @Inject(SecurityLoggerService)
    private readonly securityLogger: SecurityLoggerService,
  ) {
    super(options, storageService, reflector);
  }
  /**
   * Extracts the client IP address for rate limiting tracking
   * Handles requests behind proxy servers by checking X-Forwarded-For header
   * @param context - Execution context containing request information
   * @returns Promise resolving to the client IP address
   */
  protected async getTracker(request: Request): Promise<string> {
    // Handle cases where request might be null or undefined
    if (!request || !request.headers) {
      return 'unknown';
    }

    // Check for X-Forwarded-For header (requests behind proxy)
    const forwardedFor = request.headers['x-forwarded-for'];

    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one (original client)
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      const clientIp = ips.split(',')[0].trim();
      return clientIp;
    }

    // Check for X-Real-IP header (some proxy configurations)
    const realIp = request.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
      return realIp;
    }

    // Fallback to IP from socket or unknown
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Determines if the current request should be rate limited
   * @param context - Execution context
   * @returns Promise resolving to boolean indicating if request should proceed
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (error) {
      // Log rate limit violations for monitoring
      const request = context.switchToHttp().getRequest<Request>();

      if (request) {
        const ip = await this.getTracker(request);
        const path = request.path || 'unknown';
        const method = request.method || 'unknown';
        const userAgent = request.headers['user-agent'] || 'unknown';

        console.warn(
          `[RATE LIMIT] Request blocked: ${method} ${path} from IP ${ip} - ${error.message}`,
        );

        // Log rate limit exceeded event
        this.securityLogger.logRateLimitExceeded(
          ip,
          userAgent,
          path,
          method,
          'general', // You could make this more specific based on the context
        );
      }

      // Re-throw the error to maintain proper HTTP response
      throw error;
    }
  }
}
