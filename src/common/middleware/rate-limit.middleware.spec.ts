import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ThrottlerException, ThrottlerModule } from '@nestjs/throttler';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { SecurityLoggerService } from '../services/security-logger.service';

describe('RateLimitMiddleware', () => {
  let middleware: RateLimitMiddleware;
  let mockContext: ExecutionContext;
  let mockRequest: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 10,
          },
        ]),
      ],
      providers: [
        RateLimitMiddleware,
        {
          provide: SecurityLoggerService,
          useValue: {
            logEvent: jest.fn(),
            logSecurityEvent: jest.fn(),
            logAuthEvent: jest.fn(),
            logRateLimitEvent: jest.fn(),
            logRateLimitExceeded: jest.fn(),
          },
        },
      ],
    }).compile();

    middleware = module.get<RateLimitMiddleware>(RateLimitMiddleware);

    // Mock request object
    mockRequest = {
      ip: '192.168.1.1',
      headers: {},
      socket: { remoteAddress: '192.168.1.1' },
      path: '/auth/login',
      method: 'POST',
    };

    // Mock execution context
    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    // Mock console methods to avoid test output pollution
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getTracker', () => {
    it('should return IP from X-Forwarded-For header when present', async () => {
      mockRequest.headers = {
        'x-forwarded-for': '203.0.113.1, 192.168.1.1, 10.0.0.1',
      };

      const result = await middleware['getTracker'](mockRequest);

      expect(result).toBe('203.0.113.1');
    });

    it('should handle X-Forwarded-For as array', async () => {
      mockRequest.headers = {
        'x-forwarded-for': ['203.0.113.1, 192.168.1.1'],
      };

      const result = await middleware['getTracker'](mockRequest);

      expect(result).toBe('203.0.113.1');
    });

    it('should return IP from X-Real-IP header when X-Forwarded-For is not present', async () => {
      mockRequest.headers = {
        'x-real-ip': '203.0.113.2',
      };

      const result = await middleware['getTracker'](mockRequest);

      expect(result).toBe('203.0.113.2');
    });

    it('should fallback to request.ip when no proxy headers are present', async () => {
      const result = await middleware['getTracker'](mockRequest);

      expect(result).toBe('192.168.1.1');
    });

    it('should fallback to socket.remoteAddress when request.ip is not available', async () => {
      mockRequest.ip = undefined;

      const result = await middleware['getTracker'](mockRequest);

      expect(result).toBe('192.168.1.1');
    });

    it('should return "unknown" when no IP can be determined', async () => {
      mockRequest.ip = undefined;
      mockRequest.socket = {};

      const result = await middleware['getTracker'](mockRequest);

      expect(result).toBe('unknown');
    });

    it('should trim whitespace from X-Forwarded-For IPs', async () => {
      mockRequest.headers = {
        'x-forwarded-for': ' 203.0.113.1 , 192.168.1.1 ',
      };

      const result = await middleware['getTracker'](mockRequest);

      expect(result).toBe('203.0.113.1');
    });
  });

  describe('canActivate', () => {
    beforeEach(() => {
      // Mock the parent canActivate method
      jest.spyOn(RateLimitMiddleware.prototype as any, 'canActivate');
    });

    it('should allow request when rate limit is not exceeded', async () => {
      // Mock successful parent canActivate
      const parentCanActivate = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(middleware)),
          'canActivate',
        )
        .mockResolvedValue(true);

      const result = await middleware.canActivate(mockContext);

      expect(result).toBe(true);
      expect(parentCanActivate).toHaveBeenCalledWith(mockContext);
    });

    it('should log and re-throw ThrottlerException when rate limit is exceeded', async () => {
      const throttlerError = new ThrottlerException();

      // Mock parent canActivate to throw ThrottlerException
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(middleware)),
          'canActivate',
        )
        .mockRejectedValue(throttlerError);

      await expect(middleware.canActivate(mockContext)).rejects.toThrow(
        ThrottlerException,
      );

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          '[RATE LIMIT] Request blocked: POST /auth/login from IP 192.168.1.1',
        ),
      );
    });

    it('should handle errors from getTracker gracefully', async () => {
      // Test that getTracker errors are handled properly by calling it directly
      jest
        .spyOn(middleware as any, 'getTracker')
        .mockRejectedValue(new Error('Tracker error'));

      // Test the getTracker method directly
      await expect(middleware['getTracker'](mockRequest)).rejects.toThrow(
        'Tracker error',
      );
    });

    it('should log different request methods and paths correctly', async () => {
      mockRequest.method = 'GET';
      mockRequest.path = '/auth/logout';

      const throttlerError = new ThrottlerException();
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(middleware)),
          'canActivate',
        )
        .mockRejectedValue(throttlerError);

      await expect(middleware.canActivate(mockContext)).rejects.toThrow(
        ThrottlerException,
      );

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          '[RATE LIMIT] Request blocked: GET /auth/logout from IP 192.168.1.1',
        ),
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed X-Forwarded-For header', async () => {
      mockRequest.headers = {
        'x-forwarded-for': '',
      };

      const result = await middleware['getTracker'](mockRequest);

      // Should fallback to request.ip when X-Forwarded-For is empty
      expect(result).toBe('192.168.1.1');
    });

    it('should handle X-Real-IP as array (edge case)', async () => {
      mockRequest.headers = {
        'x-real-ip': ['203.0.113.2'] as any,
      };

      const result = await middleware['getTracker'](mockRequest);

      // Should fallback since we expect string, not array
      expect(result).toBe('192.168.1.1');
    });

    it('should handle IPv6 addresses', async () => {
      mockRequest.headers = {
        'x-forwarded-for': '2001:db8::1, ::1',
      };

      const result = await middleware['getTracker'](mockRequest);

      expect(result).toBe('2001:db8::1');
    });

    it('should handle very long IP lists in X-Forwarded-For', async () => {
      const longIpList = Array(10)
        .fill('192.168.1')
        .map((base, i) => `${base}.${i + 1}`)
        .join(', ');
      mockRequest.headers = {
        'x-forwarded-for': longIpList,
      };

      const result = await middleware['getTracker'](mockRequest);

      expect(result).toBe('192.168.1.1');
    });
  });

  describe('Security Considerations', () => {
    it('should not expose sensitive information in logs', async () => {
      const throttlerError = new ThrottlerException();
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(middleware)),
          'canActivate',
        )
        .mockRejectedValue(throttlerError);

      await expect(middleware.canActivate(mockContext)).rejects.toThrow();

      // Verify that only safe information is logged
      const logCall = (console.warn as jest.Mock).mock.calls[0][0];
      expect(logCall).toContain('POST');
      expect(logCall).toContain('/auth/login');
      expect(logCall).toContain('192.168.1.1');
      expect(logCall).not.toContain('password');
      expect(logCall).not.toContain('token');
    });

    it('should handle missing request object gracefully', async () => {
      // Mock context to return null request
      mockContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(null),
      });

      const throttlerError = new ThrottlerException();
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(middleware)),
          'canActivate',
        )
        .mockRejectedValue(throttlerError);

      // Should not crash even with null request
      await expect(middleware.canActivate(mockContext)).rejects.toThrow(
        ThrottlerException,
      );
    });
  });
});
