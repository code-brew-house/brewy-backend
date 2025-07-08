import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware to add essential security headers to responses
 * This middleware adds security headers that are not covered by helmet
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Add custom security headers
    res.setHeader('X-Request-ID', this.generateRequestId());
    res.setHeader('X-API-Version', '1.0.0');

    // Additional security headers for API responses
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()',
    );

    // Log security-relevant request information
    console.log(
      `[SECURITY] ${req.method} ${req.path} from ${req.ip} - UA: ${req.get('User-Agent')?.substring(0, 50)}`,
    );

    next();
  }

  /**
   * Generate a unique request ID for tracking
   * @returns Unique request identifier
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
