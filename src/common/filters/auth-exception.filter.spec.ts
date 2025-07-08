import { Test, TestingModule } from '@nestjs/testing';
import {
  ArgumentsHost,
  UnauthorizedException,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { AuthExceptionFilter } from './auth-exception.filter';

describe('AuthExceptionFilter', () => {
  let filter: AuthExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthExceptionFilter],
    }).compile();

    filter = module.get<AuthExceptionFilter>(AuthExceptionFilter);

    // Mock response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock request object
    mockRequest = {
      url: '/test-path',
      method: 'GET',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
      },
    };

    // Mock arguments host
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    // Mock console.warn to avoid test output
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('catch', () => {
    it('should handle UnauthorizedException correctly', () => {
      const exception = new UnauthorizedException('Test unauthorized message');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.UNAUTHORIZED,
        error: 'Unauthorized',
        message: 'Authentication required. Please provide valid credentials.',
        timestamp: expect.any(String),
        path: '/test-path',
        requestId: expect.any(String),
      });
    });

    it('should handle ForbiddenException correctly', () => {
      const exception = new ForbiddenException('Test forbidden message');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message:
          'Access denied. You do not have permission to access this resource.',
        timestamp: expect.any(String),
        path: '/test-path',
        requestId: expect.any(String),
      });
    });

    it('should handle missing request information gracefully', () => {
      const exception = new UnauthorizedException();

      // Mock arguments host with minimal request info
      const mockMinimalArgumentsHost = {
        switchToHttp: jest.fn().mockReturnValue({
          getResponse: jest.fn().mockReturnValue(mockResponse),
          getRequest: jest.fn().mockReturnValue({}),
        }),
      } as any;

      filter.catch(exception, mockMinimalArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.UNAUTHORIZED,
        error: 'Unauthorized',
        message: 'Authentication required. Please provide valid credentials.',
        timestamp: expect.any(String),
        path: 'unknown',
        requestId: expect.any(String),
      });
    });

    it('should log authentication failure for security monitoring', () => {
      const exception = new UnauthorizedException('Test message');
      const consoleSpy = jest.spyOn(console, 'warn');

      filter.catch(exception, mockArgumentsHost);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[AUTH FAILURE] GET /test-path from IP 127.0.0.1',
        ),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH DETAILS] User-Agent: test-agent'),
      );
    });

    it('should generate unique request IDs', () => {
      const exception = new UnauthorizedException();

      filter.catch(exception, mockArgumentsHost);
      const firstCallArgs = mockResponse.json.mock.calls[0][0];
      const firstRequestId = firstCallArgs.requestId;

      // Reset mocks and call again
      mockResponse.json.mockClear();
      filter.catch(exception, mockArgumentsHost);
      const secondCallArgs = mockResponse.json.mock.calls[0][0];
      const secondRequestId = secondCallArgs.requestId;

      expect(firstRequestId).toBeDefined();
      expect(secondRequestId).toBeDefined();
      expect(firstRequestId).not.toBe(secondRequestId);
      expect(firstRequestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should include timestamp in ISO format', () => {
      const exception = new UnauthorizedException();

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.timestamp).toBeDefined();
      expect(new Date(responseData.timestamp).toISOString()).toBe(
        responseData.timestamp,
      );
    });
  });
});
