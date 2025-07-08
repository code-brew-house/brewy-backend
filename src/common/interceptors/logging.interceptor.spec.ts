import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';
import { SecurityLoggerService } from '../services/security-logger.service';
import { of, throwError } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let securityLoggerService: jest.Mocked<SecurityLoggerService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;

  const mockRequest = {
    method: 'GET',
    url: '/test',
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'test-agent',
      authorization: 'Bearer test-token',
      'x-custom-header': 'custom-value',
    },
    query: { page: 1 },
    body: { email: 'test@example.com', password: 'secret123' },
    user: { id: 'user123', username: 'testuser' },
    connection: { remoteAddress: '127.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
    get: jest.fn(),
  };

  const mockResponse = {
    statusCode: 200,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingInterceptor,
        {
          provide: SecurityLoggerService,
          useValue: {
            logUnauthorizedAccess: jest.fn(),
            logSecurityEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
    securityLoggerService = module.get(SecurityLoggerService);

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as any;

    mockCallHandler = {
      handle: jest.fn(),
    } as any;

    mockRequest.get.mockImplementation((header: string) => {
      if (header === 'User-Agent') return 'test-agent';
      return undefined;
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should log successful request and response', (done) => {
      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('[REQUEST] GET /test'),
            expect.objectContaining({
              method: 'GET',
              url: '/test',
              ip: '127.0.0.1',
              userAgent: 'test-agent',
              userId: 'user123',
              username: 'testuser',
            }),
          );
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('[RESPONSE] GET /test - 200'),
            expect.objectContaining({
              statusCode: 200,
              responseTime: expect.any(Number),
              responseSize: expect.any(Number),
              userId: 'user123',
              username: 'testuser',
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should log error response and security events for 401 errors', (done) => {
      const error = new UnauthorizedException('Invalid token');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const logSpy = jest.spyOn(interceptor['logger'], 'error');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => done(new Error('Should have thrown error')),
        error: (err) => {
          expect(err).toEqual(error);
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('[RESPONSE-ERROR] GET /test - 401'),
            expect.objectContaining({
              error: expect.objectContaining({
                name: 'UnauthorizedException',
                message: 'Invalid token',
                status: 401,
              }),
            }),
          );
          expect(
            securityLoggerService.logUnauthorizedAccess,
          ).toHaveBeenCalledWith(
            '/test',
            'GET',
            '127.0.0.1',
            'test-agent',
            'Invalid token',
          );
          done();
        },
      });
    });

    it('should log error response and security events for 403 errors', (done) => {
      const error = new ForbiddenException('Access denied');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const logSpy = jest.spyOn(interceptor['logger'], 'error');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => done(new Error('Should have thrown error')),
        error: (err) => {
          expect(err).toEqual(error);
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('[RESPONSE-ERROR] GET /test - 403'),
            expect.anything(),
          );
          expect(securityLoggerService.logSecurityEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'FORBIDDEN_ACCESS',
              severity: 'HIGH',
              userId: 'user123',
              username: 'testuser',
              ipAddress: '127.0.0.1',
              userAgent: 'test-agent',
              endpoint: '/test',
              method: 'GET',
              message: 'Forbidden access attempt to GET /test',
            }),
          );
          done();
        },
      });
    });

    it('should log server errors for 500+ status codes', (done) => {
      const error = new InternalServerErrorException('Server error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const logSpy = jest.spyOn(interceptor['logger'], 'error');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => done(new Error('Should have thrown error')),
        error: (err) => {
          expect(err).toEqual(error);
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('[SERVER-ERROR] GET /test - 500'),
            expect.objectContaining({
              error: expect.any(String),
            }),
          );
          done();
        },
      });
    });

    it('should log slow responses with warning level', (done) => {
      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const warnSpy = jest.spyOn(interceptor['logger'], 'warn');

      // Mock slow response by adding delay
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        if (callCount === 1) return 1000; // Start time
        return 2500; // End time (1.5 seconds later)
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[RESPONSE-SLOW] GET /test - 200 - 1500ms'),
            expect.objectContaining({
              statusCode: 200,
              responseTime: 1500,
            }),
          );

          // Restore original Date.now
          Date.now = originalDateNow;
          done();
        },
        error: done,
      });
    });

    it('should log detailed request for sensitive endpoints', (done) => {
      const sensitiveRequest = { ...mockRequest, url: '/auth/login' };
      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(sensitiveRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const debugSpy = jest.spyOn(interceptor['logger'], 'debug');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining('[REQUEST-DETAILED] GET /auth/login'),
            expect.objectContaining({
              headers: expect.objectContaining({
                authorization: '[REDACTED]',
                'x-custom-header': 'custom-value',
              }),
              query: { page: 1 },
              body: expect.objectContaining({
                email: 'test@example.com',
                password: '[REDACTED]',
              }),
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should log protected route access for authenticated users', (done) => {
      const protectedRequest = { ...mockRequest, url: '/users/profile' };
      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(protectedRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(securityLoggerService.logSecurityEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'PROTECTED_ROUTE_ACCESS',
              severity: 'LOW',
              userId: 'user123',
              username: 'testuser',
              ipAddress: '127.0.0.1',
              userAgent: 'test-agent',
              endpoint: '/users/profile',
              method: 'GET',
              message: 'Protected route accessed: GET /users/profile',
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should handle requests without user information', (done) => {
      const anonymousRequest = { ...mockRequest, user: undefined };
      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(anonymousRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('[REQUEST] GET /test'),
            expect.objectContaining({
              method: 'GET',
              url: '/test',
              ip: '127.0.0.1',
              userAgent: 'test-agent',
              userId: undefined,
              username: undefined,
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should handle missing user-agent header', (done) => {
      const requestWithoutUA = { ...mockRequest };
      requestWithoutUA.get.mockImplementation(() => undefined);

      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(requestWithoutUA),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('[REQUEST] GET /test'),
            expect.objectContaining({
              userAgent: 'unknown',
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should generate unique request IDs', (done) => {
      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          const requestCalls = logSpy.mock.calls.filter((call) =>
            call[0].includes('[REQUEST]'),
          );
          const responseCalls = logSpy.mock.calls.filter((call) =>
            call[0].includes('[RESPONSE]'),
          );

          expect(requestCalls[0][1]).toHaveProperty('requestId');
          expect(responseCalls[0][1]).toHaveProperty('requestId');
          expect(requestCalls[0][1].requestId).toEqual(
            responseCalls[0][1].requestId,
          );
          expect(requestCalls[0][1].requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
          done();
        },
        error: done,
      });
    });

    it('should handle different IP address extraction methods', (done) => {
      const requestWithProxyHeaders = {
        ...mockRequest,
        ip: undefined,
        connection: { remoteAddress: undefined },
        socket: { remoteAddress: undefined },
        headers: {
          ...mockRequest.headers,
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
          'x-real-ip': '192.168.1.1',
        },
      };

      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(requestWithProxyHeaders),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('[REQUEST] GET /test'),
            expect.objectContaining({
              ip: '192.168.1.1',
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should calculate response size correctly', (done) => {
      const responseData = {
        message: 'success',
        data: { id: 1, name: 'test' },
      };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          const responseCalls = logSpy.mock.calls.filter((call) =>
            call[0].includes('[RESPONSE]'),
          );

          expect(responseCalls[0][1]).toHaveProperty('responseSize');
          expect(responseCalls[0][1].responseSize).toBe(
            JSON.stringify(responseData).length,
          );
          done();
        },
        error: done,
      });
    });

    it('should handle non-JSON response data', (done) => {
      const responseData = 'plain text response';
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          const responseCalls = logSpy.mock.calls.filter((call) =>
            call[0].includes('[RESPONSE]'),
          );

          expect(responseCalls[0][1]).toHaveProperty('responseSize');
          expect(responseCalls[0][1].responseSize).toBe(
            JSON.stringify(responseData).length,
          );
          done();
        },
        error: done,
      });
    });
  });

  describe('private methods', () => {
    describe('sanitizeHeaders', () => {
      it('should redact sensitive headers', () => {
        const headers = {
          authorization: 'Bearer token123',
          cookie: 'session=abc123',
          'x-api-key': 'secret-key',
          'content-type': 'application/json',
          accept: 'application/json',
        };

        const result = interceptor['sanitizeHeaders'](headers);

        expect(result).toEqual({
          authorization: '[REDACTED]',
          cookie: '[REDACTED]',
          'x-api-key': '[REDACTED]',
          'content-type': 'application/json',
          accept: 'application/json',
        });
      });
    });

    describe('sanitizeBody', () => {
      it('should redact sensitive body fields', () => {
        const body = {
          email: 'test@example.com',
          password: 'secret123',
          apiKey: 'secret-key',
          token: 'jwt-token',
          name: 'John Doe',
        };

        const result = interceptor['sanitizeBody'](body);

        expect(result).toEqual({
          email: 'test@example.com',
          password: '[REDACTED]',
          apiKey: '[REDACTED]',
          token: '[REDACTED]',
          name: 'John Doe',
        });
      });

      it('should handle non-object body', () => {
        expect(interceptor['sanitizeBody'](null)).toEqual({});
        expect(interceptor['sanitizeBody']('string')).toEqual({});
        expect(interceptor['sanitizeBody'](123)).toEqual({});
      });
    });

    describe('isSensitiveEndpoint', () => {
      it('should identify sensitive endpoints', () => {
        expect(interceptor['isSensitiveEndpoint']('/auth/login')).toBe(true);
        expect(interceptor['isSensitiveEndpoint']('/register')).toBe(true);
        expect(interceptor['isSensitiveEndpoint']('/users/profile')).toBe(true);
        expect(interceptor['isSensitiveEndpoint']('/admin/dashboard')).toBe(
          true,
        );
        expect(interceptor['isSensitiveEndpoint']('/public/health')).toBe(
          false,
        );
      });
    });

    describe('isProtectedEndpoint', () => {
      it('should identify protected endpoints', () => {
        expect(interceptor['isProtectedEndpoint']('/users/profile')).toBe(true);
        expect(interceptor['isProtectedEndpoint']('/admin/settings')).toBe(
          true,
        );
        expect(interceptor['isProtectedEndpoint']('/dashboard')).toBe(true);
        expect(interceptor['isProtectedEndpoint']('/public/health')).toBe(
          false,
        );
        expect(interceptor['isProtectedEndpoint']('/auth/login')).toBe(false);
      });
    });

    describe('getLogLevel', () => {
      it('should return appropriate log levels', () => {
        expect(interceptor['getLogLevel'](500, 100)).toBe('error');
        expect(interceptor['getLogLevel'](400, 100)).toBe('warn');
        expect(interceptor['getLogLevel'](200, 1500)).toBe('warn');
        expect(interceptor['getLogLevel'](200, 500)).toBe('log');
      });
    });
  });
});
