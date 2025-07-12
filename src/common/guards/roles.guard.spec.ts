import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../types/request.types';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (
    user: Partial<RequestUser> | null,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  describe('canActivate', () => {
    it('should allow access when no roles are required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
      const context = createMockContext(null);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when roles array is empty', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
      const context = createMockContext(null);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user is not authenticated', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
      const context = createMockContext(null);

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should deny access when user has no role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
      const context = createMockContext({ id: '1', username: 'test' });

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should allow access when user has required role', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['ADMIN', 'OWNER']);
      const context = createMockContext({
        id: '1',
        username: 'test',
        role: 'ADMIN',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user does not have required role', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['ADMIN', 'OWNER']);
      const context = createMockContext({
        id: '1',
        username: 'test',
        role: 'AGENT',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should allow access for SUPER_OWNER regardless of required roles', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['ADMIN', 'OWNER']);
      const context = createMockContext({
        id: '1',
        username: 'test',
        role: 'SUPER_OWNER',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should call reflector with correct parameters', () => {
      const getAllAndOverrideSpy = jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['ADMIN']);
      const context = createMockContext({
        id: '1',
        username: 'test',
        role: 'ADMIN',
      });

      guard.canActivate(context);

      expect(getAllAndOverrideSpy).toHaveBeenCalledWith(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });
});
