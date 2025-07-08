import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Request } from 'express';
import { SecurityLoggerService } from '../services/security-logger.service';

/**
 * Interceptor to log validation failures for security monitoring
 */
@Injectable()
export class ValidationLoggingInterceptor implements NestInterceptor {
  constructor(private readonly securityLogger: SecurityLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Check if this is a validation error
        if (error instanceof BadRequestException) {
          const request = context.switchToHttp().getRequest<Request>();
          const response = error.getResponse();

          // Extract validation errors if they exist
          let validationErrors: string[] = [];
          if (typeof response === 'object' && response !== null) {
            if ('message' in response) {
              if (Array.isArray(response.message)) {
                validationErrors = response.message;
              } else if (typeof response.message === 'string') {
                validationErrors = [response.message];
              }
            }
          }

          // Log validation failure for security monitoring
          if (validationErrors.length > 0) {
            this.securityLogger.logInputValidationFailure(
              request.path || 'unknown',
              request.method || 'unknown',
              request.ip || 'unknown',
              request.get('User-Agent') || 'unknown',
              validationErrors,
            );
          }
        }

        return throwError(() => error);
      }),
    );
  }
}
