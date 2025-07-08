import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  describe('canActivate', () => {
    it('should call super.canActivate', () => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
        }),
      } as any as ExecutionContext;

      const superCanActivateSpy = jest
        .spyOn(Object.getPrototypeOf(guard).__proto__, 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(true);

      superCanActivateSpy.mockRestore();
    });

    it('should return promise when super returns promise', async () => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
        }),
      } as any as ExecutionContext;

      const superCanActivateSpy = jest
        .spyOn(Object.getPrototypeOf(guard).__proto__, 'canActivate')
        .mockReturnValue(Promise.resolve(true));

      const result = await guard.canActivate(mockContext);

      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(true);

      superCanActivateSpy.mockRestore();
    });

    it('should return observable when super returns observable', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
        }),
      } as any as ExecutionContext;

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Observable } = require('rxjs');
      const mockObservable = new Observable((subscriber: any) => {
        subscriber.next(true);
        subscriber.complete();
      });

      const superCanActivateSpy = jest
        .spyOn(Object.getPrototypeOf(guard).__proto__, 'canActivate')
        .mockReturnValue(mockObservable);

      const result = guard.canActivate(mockContext);

      if (result && typeof result === 'object' && 'subscribe' in result) {
        result.subscribe({
          next: (value: any) => {
            expect(value).toBe(true);
            expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
            superCanActivateSpy.mockRestore();
            done();
          },
          error: done,
        });
      } else {
        done(new Error('Expected observable but got: ' + typeof result));
      }
    });
  });

  describe('handleRequest', () => {
    it('should return user when authentication is successful', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = guard.handleRequest(null, mockUser, null);

      expect(result).toBe(mockUser);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT GUARD] Authentication successful for user: 123e4567-e89b-12d3-a456-426614174000',
      );

      consoleSpy.mockRestore();
    });

    it('should throw error when authentication error occurs', () => {
      const authError = new UnauthorizedException('Token expired');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => guard.handleRequest(authError, null, null)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.handleRequest(authError, null, null)).toThrow(
        'Token expired',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT GUARD] Authentication error: Token expired',
      );

      consoleSpy.mockRestore();
    });

    it('should throw UnauthorizedException when no user is found', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => guard.handleRequest(null, null, null)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.handleRequest(null, null, null)).toThrow(
        'Authentication required',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT GUARD] Authentication failed: No user found',
      );

      consoleSpy.mockRestore();
    });

    it('should throw UnauthorizedException when user is undefined', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => guard.handleRequest(null, undefined, null)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.handleRequest(null, undefined, null)).toThrow(
        'Authentication required',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT GUARD] Authentication failed: No user found',
      );

      consoleSpy.mockRestore();
    });

    it('should throw UnauthorizedException when user is false', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => guard.handleRequest(null, false, null)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.handleRequest(null, false, null)).toThrow(
        'Authentication required',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT GUARD] Authentication failed: No user found',
      );

      consoleSpy.mockRestore();
    });

    it('should include info message when available', () => {
      const info = { message: 'Token malformed' };
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => guard.handleRequest(null, null, info)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.handleRequest(null, null, info)).toThrow(
        'Authentication required',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT GUARD] Authentication failed: Token malformed',
      );

      consoleSpy.mockRestore();
    });

    it('should handle custom error types', () => {
      const customError = new Error('Custom authentication error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => guard.handleRequest(customError, null, null)).toThrow(Error);
      expect(() => guard.handleRequest(customError, null, null)).toThrow(
        'Custom authentication error',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT GUARD] Authentication error: Custom authentication error',
      );

      consoleSpy.mockRestore();
    });

    it('should handle errors without message', () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() =>
        guard.handleRequest(errorWithoutMessage, null, null),
      ).toThrow(Error);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT GUARD] Authentication error: ',
      );

      consoleSpy.mockRestore();
    });

    it('should handle info without message', () => {
      const infoWithoutMessage = {};
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => guard.handleRequest(null, null, infoWithoutMessage)).toThrow(
        UnauthorizedException,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT GUARD] Authentication failed: No user found',
      );

      consoleSpy.mockRestore();
    });

    it('should handle user with different structure', () => {
      const userWithDifferentStructure = {
        userId: '123',
        name: 'Test User',
      };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = guard.handleRequest(
        null,
        userWithDifferentStructure,
        null,
      );

      expect(result).toBe(userWithDifferentStructure);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT GUARD] Authentication successful for user: undefined',
      );

      consoleSpy.mockRestore();
    });

    it('should handle user with null id', () => {
      const userWithNullId = {
        id: null,
        username: 'testuser',
        email: 'test@example.com',
      };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = guard.handleRequest(null, userWithNullId, null);

      expect(result).toBe(userWithNullId);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT GUARD] Authentication successful for user: null',
      );

      consoleSpy.mockRestore();
    });

    it('should handle multiple consecutive calls', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result1 = guard.handleRequest(null, mockUser, null);
      const result2 = guard.handleRequest(null, mockUser, null);

      expect(result1).toBe(mockUser);
      expect(result2).toBe(mockUser);
      expect(consoleSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent authentication requests', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const requests = Array(10)
        .fill(null)
        .map(() => guard.handleRequest(null, mockUser, null));

      requests.forEach((result) => {
        expect(result).toBe(mockUser);
      });
      expect(consoleSpy).toHaveBeenCalledTimes(10);

      consoleSpy.mockRestore();
    });

    it('should handle mixed success and failure scenarios', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const successResult = guard.handleRequest(null, mockUser, null);
      expect(successResult).toBe(mockUser);

      expect(() => guard.handleRequest(null, null, null)).toThrow(
        UnauthorizedException,
      );

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
