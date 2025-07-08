import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { PerformanceInterceptor } from './performance.interceptor';
import { of } from 'rxjs';

describe('PerformanceInterceptor', () => {
  let interceptor: PerformanceInterceptor;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;

  const mockRequest = {
    method: 'GET',
    url: '/test',
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'test-agent',
    },
    connection: { remoteAddress: '127.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PerformanceInterceptor],
    }).compile();

    interceptor = module.get<PerformanceInterceptor>(PerformanceInterceptor);

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
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
    it('should log performance metrics for fast requests', (done) => {
      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const debugSpy = jest.spyOn(interceptor['logger'], 'debug');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining('[PERFORMANCE] GET /test'),
            expect.objectContaining({
              endpoint: '/test',
              method: 'GET',
              responseTime: expect.any(Number),
              memoryDelta: expect.objectContaining({
                rss: expect.any(String),
                heapUsed: expect.any(String),
                heapTotal: expect.any(String),
              }),
              ip: '127.0.0.1',
              userAgent: 'test-agent',
              timestamp: expect.any(Date),
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should log warning for slow requests', (done) => {
      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const warnSpy = jest.spyOn(interceptor['logger'], 'warn');

      // Mock slow response
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
            expect.stringContaining('[PERFORMANCE-SLOW] GET /test - 1500ms'),
            expect.objectContaining({
              endpoint: '/test',
              method: 'GET',
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

    it('should log error for critically slow requests', (done) => {
      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const errorSpy = jest.spyOn(interceptor['logger'], 'error');

      // Mock critically slow response
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        if (callCount === 1) return 1000; // Start time
        return 7000; // End time (6 seconds later)
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining(
              '[PERFORMANCE-CRITICAL] GET /test - 6000ms',
            ),
            expect.objectContaining({
              endpoint: '/test',
              method: 'GET',
              responseTime: 6000,
            }),
          );

          // Restore original Date.now
          Date.now = originalDateNow;
          done();
        },
        error: done,
      });
    });

    it('should log memory usage warning for high memory consumption', (done) => {
      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const warnSpy = jest.spyOn(interceptor['logger'], 'warn');

      // Mock high memory usage
      let callCount = 0;
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Start memory
          return {
            rss: 100 * 1024 * 1024, // 100MB
            heapUsed: 50 * 1024 * 1024, // 50MB
            heapTotal: 80 * 1024 * 1024, // 80MB
            external: 10 * 1024 * 1024, // 10MB
            arrayBuffers: 5 * 1024 * 1024, // 5MB
          };
        } else {
          // End memory (increased by 15MB heap)
          return {
            rss: 115 * 1024 * 1024, // 115MB
            heapUsed: 65 * 1024 * 1024, // 65MB (15MB increase)
            heapTotal: 95 * 1024 * 1024, // 95MB
            external: 12 * 1024 * 1024, // 12MB
            arrayBuffers: 6 * 1024 * 1024, // 6MB
          };
        }
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
              '[MEMORY-USAGE] GET /test - Heap: +15.00 MB',
            ),
            expect.objectContaining({
              endpoint: '/test',
              method: 'GET',
              memoryUsage: expect.objectContaining({
                rss: 15 * 1024 * 1024,
                heapUsed: 15 * 1024 * 1024,
                heapTotal: 15 * 1024 * 1024,
              }),
            }),
          );

          // Restore original process.memoryUsage
          jest.restoreAllMocks();
          done();
        },
        error: done,
      });
    });

    it('should handle requests without user agent', (done) => {
      const requestWithoutUA = { ...mockRequest };
      requestWithoutUA.get.mockImplementation(() => undefined);

      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(requestWithoutUA),
      } as any);

      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const debugSpy = jest.spyOn(interceptor['logger'], 'debug');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining('[PERFORMANCE] GET /test'),
            expect.objectContaining({
              userAgent: 'unknown',
            }),
          );
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
        },
      };

      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(requestWithProxyHeaders),
      } as any);

      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      const debugSpy = jest.spyOn(interceptor['logger'], 'debug');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining('[PERFORMANCE] GET /test'),
            expect.objectContaining({
              ip: '192.168.1.1',
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

      const debugSpy = jest.spyOn(interceptor['logger'], 'debug');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining('[PERFORMANCE] GET /test'),
            expect.objectContaining({
              requestId: expect.stringMatching(/^perf_\d+_[a-z0-9]+$/),
            }),
          );
          done();
        },
        error: done,
      });
    });
  });

  describe('private methods', () => {
    describe('formatBytes', () => {
      it('should format bytes correctly', () => {
        expect(interceptor['formatBytes'](0)).toBe('0 B');
        expect(interceptor['formatBytes'](1024)).toBe('+1.00 KB');
        expect(interceptor['formatBytes'](-1024)).toBe('-1.00 KB');
        expect(interceptor['formatBytes'](1024 * 1024)).toBe('+1.00 MB');
        expect(interceptor['formatBytes'](1024 * 1024 * 1024)).toBe('+1.00 GB');
        expect(interceptor['formatBytes'](1536)).toBe('+1.50 KB');
      });
    });

    describe('getClientIp', () => {
      it('should extract IP from request.ip', () => {
        const req = { ip: '192.168.1.1' } as any;
        expect(interceptor['getClientIp'](req)).toBe('192.168.1.1');
      });

      it('should extract IP from connection.remoteAddress', () => {
        const req = {
          ip: undefined,
          connection: { remoteAddress: '192.168.1.2' },
        } as any;
        expect(interceptor['getClientIp'](req)).toBe('192.168.1.2');
      });

      it('should extract IP from socket.remoteAddress', () => {
        const req = {
          ip: undefined,
          connection: { remoteAddress: undefined },
          socket: { remoteAddress: '192.168.1.3' },
        } as any;
        expect(interceptor['getClientIp'](req)).toBe('192.168.1.3');
      });

      it('should extract IP from x-forwarded-for header', () => {
        const req = {
          ip: undefined,
          connection: { remoteAddress: undefined },
          socket: { remoteAddress: undefined },
          headers: { 'x-forwarded-for': '192.168.1.4, 10.0.0.1' },
        } as any;
        expect(interceptor['getClientIp'](req)).toBe('192.168.1.4');
      });

      it('should return unknown if no IP found', () => {
        const req = {
          ip: undefined,
          connection: { remoteAddress: undefined },
          socket: { remoteAddress: undefined },
          headers: {},
        } as any;
        expect(interceptor['getClientIp'](req)).toBe('unknown');
      });
    });

    describe('generateRequestId', () => {
      it('should generate unique request IDs', () => {
        const id1 = interceptor['generateRequestId']();
        const id2 = interceptor['generateRequestId']();

        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^perf_\d+_[a-z0-9]+$/);
        expect(id2).toMatch(/^perf_\d+_[a-z0-9]+$/);
      });
    });
  });
});
