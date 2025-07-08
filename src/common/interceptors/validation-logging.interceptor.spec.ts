import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ValidationLoggingInterceptor } from './validation-logging.interceptor';
import { SecurityLoggerService } from '../services/security-logger.service';
import { of, throwError } from 'rxjs';

describe('ValidationLoggingInterceptor', () => {
  let interceptor: ValidationLoggingInterceptor;

  const mockSecurityLogger = {
    logInputValidationFailure: jest.fn(),
  };

  const mockExecutionContext = {
    switchToHttp: jest.fn(),
  } as any;

  const mockCallHandler = {
    handle: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationLoggingInterceptor,
        {
          provide: SecurityLoggerService,
          useValue: mockSecurityLogger,
        },
      ],
    }).compile();

    interceptor = module.get<ValidationLoggingInterceptor>(
      ValidationLoggingInterceptor,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should pass through successful requests without logging', (done) => {
      const mockRequest = {
        path: '/test',
        method: 'POST',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent'),
      };

      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: () => mockRequest,
      });

      mockCallHandler.handle.mockReturnValue(of('success'));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toBe('success');
          expect(
            mockSecurityLogger.logInputValidationFailure,
          ).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should log validation failures for BadRequestException with array messages', (done) => {
      const mockRequest = {
        path: '/auth/register',
        method: 'POST',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent'),
      };

      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: () => mockRequest,
      });

      const validationError = new BadRequestException({
        message: ['email must be a valid email', 'password is too short'],
        error: 'Bad Request',
        statusCode: 400,
      });

      mockCallHandler.handle.mockReturnValue(throwError(() => validationError));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (error) => {
          expect(error).toBe(validationError);
          expect(
            mockSecurityLogger.logInputValidationFailure,
          ).toHaveBeenCalledWith(
            '/auth/register',
            'POST',
            '127.0.0.1',
            'test-agent',
            ['email must be a valid email', 'password is too short'],
          );
          done();
        },
      });
    });

    it('should log validation failures for BadRequestException with string message', (done) => {
      const mockRequest = {
        path: '/auth/login',
        method: 'POST',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent'),
      };

      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: () => mockRequest,
      });

      const validationError = new BadRequestException({
        message: 'Invalid input',
        error: 'Bad Request',
        statusCode: 400,
      });

      mockCallHandler.handle.mockReturnValue(throwError(() => validationError));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (error) => {
          expect(error).toBe(validationError);
          expect(
            mockSecurityLogger.logInputValidationFailure,
          ).toHaveBeenCalledWith(
            '/auth/login',
            'POST',
            '127.0.0.1',
            'test-agent',
            ['Invalid input'],
          );
          done();
        },
      });
    });

    it('should handle missing request information gracefully', (done) => {
      const mockRequest = {
        get: jest.fn().mockReturnValue(undefined),
      };

      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: () => mockRequest,
      });

      const validationError = new BadRequestException({
        message: ['validation error'],
        error: 'Bad Request',
        statusCode: 400,
      });

      mockCallHandler.handle.mockReturnValue(throwError(() => validationError));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (error) => {
          expect(error).toBe(validationError);
          expect(
            mockSecurityLogger.logInputValidationFailure,
          ).toHaveBeenCalledWith('unknown', 'unknown', 'unknown', 'unknown', [
            'validation error',
          ]);
          done();
        },
      });
    });

    it('should not log for non-validation errors', (done) => {
      const mockRequest = {
        path: '/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent'),
      };

      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: () => mockRequest,
      });

      const nonValidationError = new Error('Some other error');
      mockCallHandler.handle.mockReturnValue(
        throwError(() => nonValidationError),
      );

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (error) => {
          expect(error).toBe(nonValidationError);
          expect(
            mockSecurityLogger.logInputValidationFailure,
          ).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should not log when there are no validation messages', (done) => {
      const mockRequest = {
        path: '/test',
        method: 'POST',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent'),
      };

      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: () => mockRequest,
      });

      const validationError = new BadRequestException({
        error: 'Bad Request',
        statusCode: 400,
      });

      mockCallHandler.handle.mockReturnValue(throwError(() => validationError));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (error) => {
          expect(error).toBe(validationError);
          expect(
            mockSecurityLogger.logInputValidationFailure,
          ).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
