import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationGuard } from './organization.guard';
import { RequestUser } from '../types/request.types';

describe('OrganizationGuard', () => {
  let guard: OrganizationGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationGuard],
    }).compile();

    guard = module.get<OrganizationGuard>(OrganizationGuard);
  });

  const createMockContext = (
    user: Partial<RequestUser> | null,
  ): ExecutionContext => {
    const request = {
      user,
      organizationId: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  describe('canActivate', () => {
    it('should throw ForbiddenException when user is not authenticated', () => {
      const context = createMockContext(null);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Authentication required',
      );
    });

    it('should throw ForbiddenException when user has no organizationId', () => {
      const context = createMockContext({
        id: '1',
        username: 'test',
        role: 'ADMIN',
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'User must belong to an organization',
      );
    });

    it('should allow access for SUPER_OWNER with organizationId', () => {
      const context = createMockContext({
        id: '1',
        username: 'test',
        role: 'SUPER_OWNER',
        organizationId: 'org-123',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access for OWNER with organizationId', () => {
      const context = createMockContext({
        id: '1',
        username: 'test',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access for ADMIN with organizationId', () => {
      const context = createMockContext({
        id: '1',
        username: 'test',
        role: 'ADMIN',
        organizationId: 'org-123',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access for AGENT with organizationId', () => {
      const context = createMockContext({
        id: '1',
        username: 'test',
        role: 'AGENT',
        organizationId: 'org-123',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should add organizationId to request for non-SUPER_OWNER roles', () => {
      const mockRequest = {
        user: {
          id: '1',
          username: 'test',
          role: 'ADMIN',
          organizationId: 'org-123',
        },
        organizationId: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as any;

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.organizationId).toBe('org-123');
    });

    it('should not require organizationId validation for SUPER_OWNER (bypass)', () => {
      const mockRequest = {
        user: {
          id: '1',
          username: 'test',
          role: 'SUPER_OWNER',
          organizationId: 'org-123',
        },
        organizationId: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as any;

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      // SUPER_OWNER should set organizationId (falls back to user's organizationId)
      expect(mockRequest.organizationId).toBe('org-123');
    });
  });
});
