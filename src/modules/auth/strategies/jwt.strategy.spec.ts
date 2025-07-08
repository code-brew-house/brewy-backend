import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UserService } from '../../user/user.service';
import { JwtValidationService } from '../services/jwt-validation.service';
import { SecurityLoggerService } from '../../../common/services/security-logger.service';
import { JwtPayload } from '../types/auth.types';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userService: jest.Mocked<UserService>;
  let jwtValidationService: jest.Mocked<JwtValidationService>;
  let securityLogger: jest.Mocked<SecurityLoggerService>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    password: 'hashedpassword123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJwtPayload: JwtPayload = {
    sub: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
  };

  const mockRequest = {
    headers: {
      authorization: 'Bearer jwt-token-123',
    },
    ip: '127.0.0.1',
    get: jest.fn((header: string) => {
      if (header === 'User-Agent') return 'test-agent';
      return undefined;
    }),
    path: '/api/test',
    method: 'GET',
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        return undefined;
      }),
    };

    const mockUserService = {
      findById: jest.fn(),
    };

    const mockJwtValidationService = {
      extractTokenFromHeader: jest.fn(),
      isTokenExpiringSoon: jest.fn(),
    };

    const mockSecurityLogger = {
      logTokenValidationSuccess: jest.fn(),
      logTokenValidationFailure: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UserService, useValue: mockUserService },
        { provide: JwtValidationService, useValue: mockJwtValidationService },
        { provide: SecurityLoggerService, useValue: mockSecurityLogger },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    userService = module.get(UserService);
    jwtValidationService = module.get(JwtValidationService);
    securityLogger = module.get(SecurityLoggerService);
  });

  describe('validate', () => {
    it('should return user object when token is valid', async () => {
      jwtValidationService.extractTokenFromHeader.mockReturnValue(
        'jwt-token-123',
      );
      jwtValidationService.isTokenExpiringSoon.mockResolvedValue(false);
      userService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(mockRequest, mockJwtPayload);

      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        fullName: mockUser.fullName,
      });
      expect(userService.findById).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(securityLogger.logTokenValidationSuccess).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.username,
        mockRequest.ip,
        'test-agent',
        mockRequest.path,
        mockRequest.method,
      );
    });

    it('should log warning when token is expiring soon', async () => {
      jwtValidationService.extractTokenFromHeader.mockReturnValue(
        'jwt-token-123',
      );
      jwtValidationService.isTokenExpiringSoon.mockResolvedValue(true);
      userService.findById.mockResolvedValue(mockUser);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await strategy.validate(mockRequest, mockJwtPayload);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT STRATEGY] Token expiring soon for user: 123e4567-e89b-12d3-a456-426614174000',
      );

      consoleSpy.mockRestore();
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      jwtValidationService.extractTokenFromHeader.mockReturnValue(
        'jwt-token-123',
      );
      jwtValidationService.isTokenExpiringSoon.mockResolvedValue(false);
      userService.findById.mockRejectedValue(new Error('User not found'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow('Invalid token - user not found');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT STRATEGY] User not found for ID: 123e4567-e89b-12d3-a456-426614174000',
      );

      consoleSpy.mockRestore();
    });

    it('should throw UnauthorizedException when email mismatch', async () => {
      const userWithDifferentEmail = {
        ...mockUser,
        email: 'different@example.com',
      };

      jwtValidationService.extractTokenFromHeader.mockReturnValue(
        'jwt-token-123',
      );
      jwtValidationService.isTokenExpiringSoon.mockResolvedValue(false);
      userService.findById.mockResolvedValue(userWithDifferentEmail);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow('Token email mismatch');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT STRATEGY] Email mismatch for user: 123e4567-e89b-12d3-a456-426614174000',
      );
      expect(securityLogger.logTokenValidationFailure).toHaveBeenCalledWith(
        'Token email mismatch',
        mockRequest.ip,
        'test-agent',
        mockRequest.path,
        mockRequest.method,
      );

      consoleSpy.mockRestore();
    });

    it('should throw UnauthorizedException when username mismatch', async () => {
      const userWithDifferentUsername = {
        ...mockUser,
        username: 'differentuser',
      };

      jwtValidationService.extractTokenFromHeader.mockReturnValue(
        'jwt-token-123',
      );
      jwtValidationService.isTokenExpiringSoon.mockResolvedValue(false);
      userService.findById.mockResolvedValue(userWithDifferentUsername);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow('Token username mismatch');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT STRATEGY] Username mismatch for user: 123e4567-e89b-12d3-a456-426614174000',
      );
      expect(securityLogger.logTokenValidationFailure).toHaveBeenCalledWith(
        'Token username mismatch',
        mockRequest.ip,
        'test-agent',
        mockRequest.path,
        mockRequest.method,
      );

      consoleSpy.mockRestore();
    });

    it('should handle request without authorization header', async () => {
      const requestWithoutAuth = {
        ...mockRequest,
        headers: {},
      };

      userService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(
        requestWithoutAuth,
        mockJwtPayload,
      );

      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        fullName: mockUser.fullName,
      });
      expect(
        jwtValidationService.extractTokenFromHeader,
      ).not.toHaveBeenCalled();
      expect(jwtValidationService.isTokenExpiringSoon).not.toHaveBeenCalled();
    });

    it('should handle userService error and throw UnauthorizedException', async () => {
      jwtValidationService.extractTokenFromHeader.mockReturnValue(
        'jwt-token-123',
      );
      jwtValidationService.isTokenExpiringSoon.mockResolvedValue(false);
      userService.findById.mockRejectedValue(new Error('Database error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow('Invalid token');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT STRATEGY] Token validation failed: Database error',
      );
      expect(securityLogger.logTokenValidationFailure).toHaveBeenCalledWith(
        'Database error',
        mockRequest.ip,
        'test-agent',
        mockRequest.path,
        mockRequest.method,
        mockRequest.headers.authorization,
      );

      consoleSpy.mockRestore();
    });

    it('should preserve UnauthorizedException from userService', async () => {
      jwtValidationService.extractTokenFromHeader.mockReturnValue(
        'jwt-token-123',
      );
      jwtValidationService.isTokenExpiringSoon.mockResolvedValue(false);
      userService.findById.mockRejectedValue(
        new UnauthorizedException('User not found'),
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow('User not found');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT STRATEGY] Token validation failed: User not found',
      );

      consoleSpy.mockRestore();
    });

    it('should handle request with missing IP and User-Agent', async () => {
      const requestWithMissingData = {
        ...mockRequest,
        ip: undefined,
        get: jest.fn(() => undefined),
      };

      userService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(
        requestWithMissingData,
        mockJwtPayload,
      );

      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        fullName: mockUser.fullName,
      });
      expect(securityLogger.logTokenValidationSuccess).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.username,
        'unknown',
        'unknown',
        mockRequest.path,
        mockRequest.method,
      );
    });

    it('should handle JWT validation service errors', async () => {
      jwtValidationService.extractTokenFromHeader.mockImplementation(() => {
        throw new Error('Token extraction failed');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow(UnauthorizedException);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT STRATEGY] Token validation failed: Token extraction failed',
      );

      consoleSpy.mockRestore();
    });

    it('should log successful validation', async () => {
      jwtValidationService.extractTokenFromHeader.mockReturnValue(
        'jwt-token-123',
      );
      jwtValidationService.isTokenExpiringSoon.mockResolvedValue(false);
      userService.findById.mockResolvedValue(mockUser);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await strategy.validate(mockRequest, mockJwtPayload);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[JWT STRATEGY] Successfully validated token for user: 123e4567-e89b-12d3-a456-426614174000',
      );

      consoleSpy.mockRestore();
    });
  });
});
