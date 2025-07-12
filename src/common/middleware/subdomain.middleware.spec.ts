import { Request, Response, NextFunction } from 'express';
import { Test, TestingModule } from '@nestjs/testing';
import { SubdomainMiddleware } from './subdomain.middleware';

describe('SubdomainMiddleware', () => {
  let middleware: SubdomainMiddleware;
  let mockRequest: Partial<Request & { organizationSubdomain?: string }>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubdomainMiddleware],
    }).compile();

    middleware = module.get<SubdomainMiddleware>(SubdomainMiddleware);
    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    mockNext = jest.fn();
  });

  describe('use', () => {
    it('should call next() when no subdomain header is present', () => {
      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.organizationSubdomain).toBeUndefined();
    });

    it('should set organizationSubdomain when valid subdomain header is present', () => {
      mockRequest.headers = {
        'x-organization-subdomain': 'test-org',
      };

      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.organizationSubdomain).toBe('test-org');
    });

    it('should convert subdomain to lowercase', () => {
      mockRequest.headers = {
        'x-organization-subdomain': 'TEST-ORG',
      };

      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.organizationSubdomain).toBe('test-org');
    });

    it('should accept alphanumeric subdomain', () => {
      mockRequest.headers = {
        'x-organization-subdomain': 'test123',
      };

      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.organizationSubdomain).toBe('test123');
    });

    it('should accept subdomain with hyphens', () => {
      mockRequest.headers = {
        'x-organization-subdomain': 'test-org-123',
      };

      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.organizationSubdomain).toBe('test-org-123');
    });

    it('should reject subdomain with special characters', () => {
      mockRequest.headers = {
        'x-organization-subdomain': 'test@org',
      };

      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.organizationSubdomain).toBeUndefined();
    });

    it('should reject subdomain with spaces', () => {
      mockRequest.headers = {
        'x-organization-subdomain': 'test org',
      };

      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.organizationSubdomain).toBeUndefined();
    });

    it('should reject subdomain with uppercase letters after validation', () => {
      mockRequest.headers = {
        'x-organization-subdomain': 'testOrg',
      };

      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      // Should be converted to lowercase and accepted
      expect(mockRequest.organizationSubdomain).toBe('testorg');
    });

    it('should reject empty subdomain', () => {
      mockRequest.headers = {
        'x-organization-subdomain': '',
      };

      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.organizationSubdomain).toBeUndefined();
    });

    it('should handle array header values by taking the first one', () => {
      mockRequest.headers = {
        'x-organization-subdomain': ['test-org', 'other-org'],
      };

      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.organizationSubdomain).toBe('test-org');
    });

    it('should reject subdomain with underscores', () => {
      mockRequest.headers = {
        'x-organization-subdomain': 'test_org',
      };

      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.organizationSubdomain).toBeUndefined();
    });

    it('should reject subdomain with dots', () => {
      mockRequest.headers = {
        'x-organization-subdomain': 'test.org',
      };

      middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.organizationSubdomain).toBeUndefined();
    });
  });
});
