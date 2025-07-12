import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to extract organization subdomain from X-Organization-Subdomain header
 *
 * This middleware extracts the organization subdomain from the custom header
 * and makes it available in the request object for downstream processing.
 *
 * The middleware:
 * 1. Extracts the subdomain from the X-Organization-Subdomain header
 * 2. Validates the subdomain format (alphanumeric and hyphens only)
 * 3. Adds the subdomain to the request object
 * 4. Provides a way for organization resolution in authentication
 *
 * Usage:
 * Configure in app.module.ts:
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer
 *       .apply(SubdomainMiddleware)
 *       .forRoutes('*');
 *   }
 * }
 *
 * Then in your service:
 * const subdomain = request.organizationSubdomain;
 */
@Injectable()
export class SubdomainMiddleware implements NestMiddleware {
  use(
    req: Request & { organizationSubdomain?: string },
    res: Response,
    next: NextFunction,
  ) {
    const subdomainHeader = req.headers['x-organization-subdomain'] as string;

    if (subdomainHeader) {
      // Handle array headers by taking the first value
      const subdomain = Array.isArray(subdomainHeader)
        ? subdomainHeader[0]
        : subdomainHeader;

      // Convert to lowercase first
      const lowerSubdomain = subdomain.toLowerCase();

      // Validate subdomain format (alphanumeric and hyphens only)
      const isValidSubdomain = /^[a-z0-9-]+$/.test(lowerSubdomain);

      if (isValidSubdomain) {
        // Add subdomain to request for downstream usage
        req.organizationSubdomain = lowerSubdomain;
      }
    }

    next();
  }
}
