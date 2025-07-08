import { Test, TestingModule } from '@nestjs/testing';
import { SecurityHeadersMiddleware } from './security-headers.middleware';
import { Request, Response } from 'express';

describe('SecurityHeadersMiddleware', () => {
  let middleware: SecurityHeadersMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SecurityHeadersMiddleware],
    }).compile();

    middleware = module.get<SecurityHeadersMiddleware>(
      SecurityHeadersMiddleware,
    );

    mockRequest = {
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();

    // Mock console.log to avoid test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('use', () => {
    it('should set all required security headers', () => {
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Request-ID',
        expect.stringMatching(/^req_\d+_[a-z0-9]+$/),
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-API-Version',
        '1.0.0',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Permitted-Cross-Domain-Policies',
        'none',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Permissions-Policy',
        'geolocation=(), microphone=(), camera=()',
      );
    });

    it('should call next function', () => {
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should log security information', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] GET /test from 127.0.0.1'),
      );
    });

    it('should handle missing User-Agent header gracefully', () => {
      mockRequest.get = jest.fn().mockReturnValue(undefined);

      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).not.toThrow();
    });

    it('should generate unique request IDs', () => {
      const setHeaderSpy = jest.spyOn(mockResponse, 'setHeader');

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      const firstRequestId = setHeaderSpy.mock.calls.find(
        (call) => call[0] === 'X-Request-ID',
      )?.[1];

      setHeaderSpy.mockClear();

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      const secondRequestId = setHeaderSpy.mock.calls.find(
        (call) => call[0] === 'X-Request-ID',
      )?.[1];

      expect(firstRequestId).toBeDefined();
      expect(secondRequestId).toBeDefined();
      expect(firstRequestId).not.toBe(secondRequestId);
    });

    it('should truncate long User-Agent strings', () => {
      const longUserAgent = 'a'.repeat(100);
      mockRequest.get = jest.fn().mockReturnValue(longUserAgent);
      const consoleSpy = jest.spyOn(console, 'log');

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('a'.repeat(50)),
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('a'.repeat(51)),
      );
    });
  });
});
