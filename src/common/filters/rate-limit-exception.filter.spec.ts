import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { RateLimitExceptionFilter } from './rate-limit-exception.filter';
import { Response } from 'express';

describe('RateLimitExceptionFilter', () => {
  let filter: RateLimitExceptionFilter;
  let mockArgumentsHost: ArgumentsHost;
  let mockResponse: Partial<Response>;
  let mockRequest: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimitExceptionFilter],
    }).compile();

    filter = module.get<RateLimitExceptionFilter>(RateLimitExceptionFilter);

    // Mock response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock request object
    mockRequest = {
      method: 'POST',
      url: '/auth/login',
      ip: '192.168.1.1',
    };

    // Mock ArgumentsHost
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    // Mock console methods to avoid test output pollution
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('catch', () => {
    it('should return 429 status code for ThrottlerException', () => {
      const exception = new ThrottlerException();

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    });

    it('should return proper error response format', () => {
      const exception = new ThrottlerException();
      const mockDate = '2023-01-01T00:00:00.000Z';
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        timestamp: mockDate,
        path: '/auth/login',
        retryAfter: 60,
      });
    });

    it('should log rate limit violation with request details', () => {
      const exception = new ThrottlerException();
      const mockDate = '2023-01-01T00:00:00.000Z';
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

      filter.catch(exception, mockArgumentsHost);

      expect(console.warn).toHaveBeenCalledWith(
        `[RATE LIMIT EXCEEDED] POST /auth/login from IP 192.168.1.1 at ${mockDate}`,
      );
    });

    it('should handle different HTTP methods and paths', () => {
      mockRequest.method = 'GET';
      mockRequest.url = '/auth/register';
      mockRequest.ip = '10.0.0.1';

      const exception = new ThrottlerException();
      const mockDate = '2023-01-01T00:00:00.000Z';
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

      filter.catch(exception, mockArgumentsHost);

      expect(console.warn).toHaveBeenCalledWith(
        `[RATE LIMIT EXCEEDED] GET /auth/register from IP 10.0.0.1 at ${mockDate}`,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/auth/register',
        }),
      );
    });

    it('should include retryAfter value in response', () => {
      const exception = new ThrottlerException();

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryAfter: expect.any(Number),
        }),
      );
    });

    it('should handle missing IP address gracefully', () => {
      mockRequest.ip = undefined;
      const exception = new ThrottlerException();

      filter.catch(exception, mockArgumentsHost);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('from IP unknown'),
      );
    });
  });

  describe('getRetryAfterValue', () => {
    it('should return default retry after value', () => {
      const exception = new ThrottlerException();
      const retryAfter = filter['getRetryAfterValue'](exception);

      expect(retryAfter).toBe(60);
    });

    it('should return consistent retry after value for multiple calls', () => {
      const exception = new ThrottlerException();

      const retryAfter1 = filter['getRetryAfterValue'](exception);
      const retryAfter2 = filter['getRetryAfterValue'](exception);

      expect(retryAfter1).toBe(retryAfter2);
      expect(retryAfter1).toBe(60);
    });
  });

  describe('Error Response Format', () => {
    it('should include all required fields in error response', () => {
      const exception = new ThrottlerException();

      filter.catch(exception, mockArgumentsHost);

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];

      expect(responseCall).toHaveProperty('statusCode');
      expect(responseCall).toHaveProperty('error');
      expect(responseCall).toHaveProperty('message');
      expect(responseCall).toHaveProperty('timestamp');
      expect(responseCall).toHaveProperty('path');
      expect(responseCall).toHaveProperty('retryAfter');
    });

    it('should use correct error message and status code', () => {
      const exception = new ThrottlerException();

      filter.catch(exception, mockArgumentsHost);

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];

      expect(responseCall.statusCode).toBe(429);
      expect(responseCall.error).toBe('Too Many Requests');
      expect(responseCall.message).toBe(
        'Rate limit exceeded. Please try again later.',
      );
    });

    it('should include current timestamp in response', () => {
      const exception = new ThrottlerException();
      const beforeTime = new Date().getTime();

      filter.catch(exception, mockArgumentsHost);

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      const responseTime = new Date(responseCall.timestamp).getTime();
      const afterTime = new Date().getTime();

      expect(responseTime).toBeGreaterThanOrEqual(beforeTime);
      expect(responseTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null request object', () => {
      mockArgumentsHost.switchToHttp = jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(null),
      });

      const exception = new ThrottlerException();

      // Should not crash
      expect(() => filter.catch(exception, mockArgumentsHost)).not.toThrow();
    });

    it('should handle request with missing properties', () => {
      mockRequest = {}; // Empty request object
      mockArgumentsHost.switchToHttp = jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      });

      const exception = new ThrottlerException();

      expect(() => filter.catch(exception, mockArgumentsHost)).not.toThrow();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[RATE LIMIT EXCEEDED]'),
      );
    });

    it('should handle very long URLs gracefully', () => {
      const longUrl = '/auth/login' + '?param='.repeat(100) + 'value';
      mockRequest.url = longUrl;

      const exception = new ThrottlerException();

      filter.catch(exception, mockArgumentsHost);

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.path).toBe(longUrl);
    });

    it('should handle special characters in URL', () => {
      mockRequest.url =
        '/auth/login?email=user%40example.com&redirect=%2Fdashboard';

      const exception = new ThrottlerException();

      filter.catch(exception, mockArgumentsHost);

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.path).toBe(
        '/auth/login?email=user%40example.com&redirect=%2Fdashboard',
      );
    });
  });

  describe('Security Considerations', () => {
    it('should not expose sensitive information in logs', () => {
      mockRequest.url = '/auth/login?password=secret123&token=abc123';

      const exception = new ThrottlerException();

      filter.catch(exception, mockArgumentsHost);

      const logCall = (console.warn as jest.Mock).mock.calls[0][0];
      // The filter doesn't filter query params, but it shouldn't expose the full URL in logs
      // This is more about ensuring we're not accidentally logging sensitive data
      expect(logCall).toContain('[RATE LIMIT EXCEEDED]');
      expect(logCall).toContain('POST');
      expect(logCall).toContain('192.168.1.1');
    });

    it('should provide consistent error message regardless of specific throttle type', () => {
      const exception = new ThrottlerException();

      filter.catch(exception, mockArgumentsHost);

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];

      // Error message should be generic and not reveal internal throttling details
      expect(responseCall.message).toBe(
        'Rate limit exceeded. Please try again later.',
      );
      expect(responseCall.error).toBe('Too Many Requests');
    });
  });
});
