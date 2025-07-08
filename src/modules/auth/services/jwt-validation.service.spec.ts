import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtValidationService } from './jwt-validation.service';

describe('JwtValidationService', () => {
  let service: JwtValidationService;
  // Services are mocked, no need to assign them to variables

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtValidationService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<JwtValidationService>(JwtValidationService);

    // Setup default config values
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-secret',
          JWT_EXPIRES_IN: '24h',
        };
        return config[key] || defaultValue;
      },
    );

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateToken', () => {
    const validPayload = {
      sub: '123e4567-e89b-12d3-a456-426614174000',
      username: 'testuser',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    it('should validate a valid token successfully', async () => {
      mockJwtService.verifyAsync.mockResolvedValue(validPayload);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(validPayload);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
        secret: 'fallback-secret', // Service uses fallback when config returns undefined
      });
    });

    it('should remove Bearer prefix from token', async () => {
      mockJwtService.verifyAsync.mockResolvedValue(validPayload);

      await service.validateToken('Bearer valid-token');

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
        secret: 'test-secret',
      });
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      mockJwtService.verifyAsync.mockRejectedValue(expiredError);

      await expect(service.validateToken('expired-token')).rejects.toThrow(
        new UnauthorizedException('Token has expired'),
      );
    });

    it('should throw UnauthorizedException for invalid token format', async () => {
      const invalidError = new Error('Invalid token');
      invalidError.name = 'JsonWebTokenError';
      mockJwtService.verifyAsync.mockRejectedValue(invalidError);

      await expect(service.validateToken('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Invalid token format'),
      );
    });

    it('should throw UnauthorizedException for token not yet valid', async () => {
      const notBeforeError = new Error('Token not yet valid');
      notBeforeError.name = 'NotBeforeError';
      mockJwtService.verifyAsync.mockRejectedValue(notBeforeError);

      await expect(
        service.validateToken('not-yet-valid-token'),
      ).rejects.toThrow(new UnauthorizedException('Token not yet valid'));
    });

    it('should throw UnauthorizedException for missing required fields', async () => {
      const incompletePayload = {
        sub: '123e4567-e89b-12d3-a456-426614174000',
        // Missing username, email, iat, exp
      };
      mockJwtService.verifyAsync.mockResolvedValue(incompletePayload);

      await expect(service.validateToken('incomplete-token')).rejects.toThrow(
        new UnauthorizedException('Token missing required field: username'),
      );
    });

    it('should throw UnauthorizedException for invalid email format', async () => {
      const invalidEmailPayload = {
        ...validPayload,
        email: 'invalid-email',
      };
      mockJwtService.verifyAsync.mockResolvedValue(invalidEmailPayload);

      await expect(
        service.validateToken('invalid-email-token'),
      ).rejects.toThrow(
        new UnauthorizedException('Token contains invalid email format'),
      );
    });

    it('should throw UnauthorizedException for invalid username format', async () => {
      const invalidUsernamePayload = {
        ...validPayload,
        username: 'a', // Too short
      };
      mockJwtService.verifyAsync.mockResolvedValue(invalidUsernamePayload);

      await expect(
        service.validateToken('invalid-username-token'),
      ).rejects.toThrow(
        new UnauthorizedException('Token contains invalid username format'),
      );
    });

    it('should throw UnauthorizedException for invalid UUID format', async () => {
      const invalidUuidPayload = {
        ...validPayload,
        sub: 'not-a-uuid',
      };
      mockJwtService.verifyAsync.mockResolvedValue(invalidUuidPayload);

      await expect(service.validateToken('invalid-uuid-token')).rejects.toThrow(
        new UnauthorizedException('Token contains invalid subject format'),
      );
    });

    it('should warn when token expires soon', async () => {
      const soonExpiringPayload = {
        ...validPayload,
        exp: Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
      };
      mockJwtService.verifyAsync.mockResolvedValue(soonExpiringPayload);
      const warnSpy = jest.spyOn(console, 'warn');

      await service.validateToken('soon-expiring-token');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token expires soon for user:'),
      );
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Authorization header', () => {
      const result = service.extractTokenFromHeader('Bearer valid-token');
      expect(result).toBe('valid-token');
    });

    it('should throw UnauthorizedException for missing header', () => {
      expect(() => service.extractTokenFromHeader('')).toThrow(
        new UnauthorizedException('Authorization header missing'),
      );
    });

    it('should throw UnauthorizedException for invalid header format', () => {
      expect(() => service.extractTokenFromHeader('InvalidFormat')).toThrow(
        new UnauthorizedException('Invalid authorization header format'),
      );
    });

    it('should throw UnauthorizedException for short token', () => {
      expect(() => service.extractTokenFromHeader('Bearer short')).toThrow(
        new UnauthorizedException('Invalid token format'),
      );
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('should return true for token expiring soon', async () => {
      const soonExpiringPayload = {
        sub: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes from now
      };
      mockJwtService.verifyAsync.mockResolvedValue(soonExpiringPayload);

      const result = await service.isTokenExpiringSoon('token', 15);
      expect(result).toBe(true);
    });

    it('should return false for token not expiring soon', async () => {
      const validPayload = {
        sub: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };
      mockJwtService.verifyAsync.mockResolvedValue(validPayload);

      const result = await service.isTokenExpiringSoon('token', 15);
      expect(result).toBe(false);
    });

    it('should return true for invalid token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      const result = await service.isTokenExpiringSoon('invalid-token');
      expect(result).toBe(true);
    });
  });

  describe('getTokenExpiration', () => {
    it('should return correct expiration date', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const payload = {
        sub: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp,
      };
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.getTokenExpiration('token');
      expect(result).toEqual(new Date(exp * 1000));
    });
  });

  describe('getTokenIssuedAt', () => {
    it('should return correct issued at date', async () => {
      const iat = Math.floor(Date.now() / 1000) - 3600;
      const payload = {
        sub: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        iat,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.getTokenIssuedAt('token');
      expect(result).toEqual(new Date(iat * 1000));
    });
  });
});
