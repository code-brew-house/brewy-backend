import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  userAgent: string;
  ip: string;
  requestId?: string;
}

/**
 * Performance monitoring interceptor
 * Tracks response times, memory usage, and identifies slow endpoints
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);
  private readonly performanceThreshold = 1000; // 1 second threshold for slow requests
  private readonly criticalThreshold = 5000; // 5 seconds threshold for critical slow requests

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    const request = context.switchToHttp().getRequest<Request>();

    const requestId = this.generateRequestId();

    return next.handle().pipe(
      tap(() => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const endMemory = process.memoryUsage();

        const metrics: PerformanceMetrics = {
          endpoint: request.url,
          method: request.method,
          responseTime,
          timestamp: new Date(),
          memoryUsage: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            external: endMemory.external - startMemory.external,
            arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
          },
          userAgent: request.get('User-Agent') || 'unknown',
          ip: this.getClientIp(request),
          requestId,
        };

        this.logPerformanceMetrics(metrics);
      }),
    );
  }

  /**
   * Log performance metrics with appropriate severity
   */
  private logPerformanceMetrics(metrics: PerformanceMetrics): void {
    const logData = {
      requestId: metrics.requestId,
      endpoint: metrics.endpoint,
      method: metrics.method,
      responseTime: metrics.responseTime,
      memoryDelta: {
        rss: this.formatBytes(metrics.memoryUsage.rss),
        heapUsed: this.formatBytes(metrics.memoryUsage.heapUsed),
        heapTotal: this.formatBytes(metrics.memoryUsage.heapTotal),
      },
      ip: metrics.ip,
      userAgent: metrics.userAgent,
      timestamp: metrics.timestamp,
    };

    if (metrics.responseTime > this.criticalThreshold) {
      this.logger.error(
        `[PERFORMANCE-CRITICAL] ${metrics.method} ${metrics.endpoint} - ${metrics.responseTime}ms`,
        logData,
      );
    } else if (metrics.responseTime > this.performanceThreshold) {
      this.logger.warn(
        `[PERFORMANCE-SLOW] ${metrics.method} ${metrics.endpoint} - ${metrics.responseTime}ms`,
        logData,
      );
    } else {
      this.logger.debug(
        `[PERFORMANCE] ${metrics.method} ${metrics.endpoint} - ${metrics.responseTime}ms`,
        logData,
      );
    }

    // Log memory usage if significant
    if (Math.abs(metrics.memoryUsage.heapUsed) > 10 * 1024 * 1024) {
      // 10MB threshold
      this.logger.warn(
        `[MEMORY-USAGE] ${metrics.method} ${metrics.endpoint} - Heap: ${this.formatBytes(metrics.memoryUsage.heapUsed)}`,
        {
          requestId: metrics.requestId,
          endpoint: metrics.endpoint,
          method: metrics.method,
          memoryUsage: metrics.memoryUsage,
        },
      );
    }
  }

  /**
   * Generate unique request ID for correlation
   */
  private generateRequestId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: Request): string {
    return (
      request.ip ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      'unknown'
    );
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

    const value = Math.abs(bytes) / Math.pow(k, i);
    const sign = bytes < 0 ? '-' : '+';

    return `${sign}${value.toFixed(2)} ${sizes[i]}`;
  }
}
