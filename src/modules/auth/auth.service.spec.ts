import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './types/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { UserResponseDto } from '../user/dto/user-response.dto';

describe('AuthService', () => {
  let authService: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    password: 'hashedpassword123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Commenting out unused variable to pass linting
  // const mockUserResponse = new UserResponseDto(mockUser);

  beforeEach(async () => {
    const mockUserService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findById: jest.fn(),
      validatePassword: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockPrismaService = {
      user: {
        update: jest.fn().mockResolvedValue({
          id: 'user-id',
          failedAttempts: 1,
          lockedUntil: null,
          lastFailedLogin: new Date(),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      fullName: 'Test User',
    };

    it('should successfully register a new user', async () => {
      const mockAccessToken = 'jwt-token-123';
      const mockExpiresIn = 86400;

      userService.create.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue(mockAccessToken);
      configService.get.mockReturnValue('24h');

      const result = await authService.register(registerDto);

      expect(userService.create).toHaveBeenCalledWith({
        username: registerDto.username,
        email: registerDto.email,
        password: registerDto.password,
        fullName: registerDto.fullName,
      });

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
      });

      expect(result).toBeInstanceOf(AuthResponseDto);
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.expiresIn).toBe(mockExpiresIn);
      expect(result.user).toBeDefined();
    });

    it('should throw ConflictException when user already exists', async () => {
      const conflictError = new ConflictException('User already exists');
      userService.create.mockRejectedValue(conflictError);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException for unexpected errors', async () => {
      const unexpectedError = new Error('Database connection failed');
      userService.create.mockRejectedValue(unexpectedError);

      await expect(authService.register(registerDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle JWT signing errors', async () => {
      const jwtError = new Error('JWT signing failed');
      userService.create.mockResolvedValue(mockUser);
      jwtService.signAsync.mockRejectedValue(jwtError);

      await expect(authService.register(registerDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      identifier: 'test@example.com',
      password: 'Password123!',
    };

    it('should successfully login with email', async () => {
      const mockAccessToken = 'jwt-token-123';
      const mockExpiresIn = 86400;

      userService.findByEmail.mockResolvedValue(mockUser);
      userService.validatePassword.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue(mockAccessToken);
      configService.get.mockReturnValue('24h');

      const result = await authService.login(loginDto);

      expect(userService.findByEmail).toHaveBeenCalledWith(loginDto.identifier);
      expect(userService.validatePassword).toHaveBeenCalledWith(
        mockUser,
        loginDto.password,
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
      });

      expect(result).toBeInstanceOf(AuthResponseDto);
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.expiresIn).toBe(mockExpiresIn);
      expect(result.user).toBeInstanceOf(UserResponseDto);
    });

    it('should successfully login with username', async () => {
      const mockAccessToken = 'jwt-token-123';
      const usernameLoginDto = { ...loginDto, identifier: 'testuser' };

      userService.findByEmail.mockResolvedValue(null);
      userService.findByUsername.mockResolvedValue(mockUser);
      userService.validatePassword.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue(mockAccessToken);
      configService.get.mockReturnValue('24h');

      const result = await authService.login(usernameLoginDto);

      expect(userService.findByEmail).toHaveBeenCalledWith(
        usernameLoginDto.identifier,
      );
      expect(userService.findByUsername).toHaveBeenCalledWith(
        usernameLoginDto.identifier,
      );
      expect(result).toBeInstanceOf(AuthResponseDto);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.findByUsername.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userService.validatePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      userService.findByEmail.mockResolvedValue(mockUser);
      userService.validatePassword.mockResolvedValue(false);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw InternalServerErrorException for unexpected errors', async () => {
      const unexpectedError = new Error('Database connection failed');
      userService.findByEmail.mockRejectedValue(unexpectedError);

      await expect(authService.login(loginDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle JWT signing errors during login', async () => {
      const jwtError = new Error('JWT signing failed');
      userService.findByEmail.mockResolvedValue(mockUser);
      userService.validatePassword.mockResolvedValue(true);
      jwtService.signAsync.mockRejectedValue(jwtError);

      await expect(authService.login(loginDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('logout', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';

    it('should successfully logout a user', async () => {
      await expect(authService.logout(userId)).resolves.not.toThrow();
    });

    it('should handle errors during logout', async () => {
      // Mock console.error to avoid cluttering test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Force an error by making the method throw
      jest.spyOn(authService, 'logout').mockImplementationOnce(() => {
        throw new Error('Logout failed');
      });

      await expect(authService.logout(userId)).rejects.toThrow(
        InternalServerErrorException,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('validateUser', () => {
    const jwtPayload: JwtPayload = {
      sub: '123e4567-e89b-12d3-a456-426614174000',
      username: 'testuser',
      email: 'test@example.com',
    };

    it('should return user when valid payload is provided', async () => {
      userService.findById.mockResolvedValue(mockUser);

      const result = await authService.validateUser(jwtPayload);

      expect(userService.findById).toHaveBeenCalledWith(jwtPayload.sub);
      expect(result).toBe(mockUser);
    });

    it('should return null when user not found', async () => {
      userService.findById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      const result = await authService.validateUser(jwtPayload);

      expect(userService.findById).toHaveBeenCalledWith(jwtPayload.sub);
      expect(result).toBeNull();
    });

    it('should return null when service throws error', async () => {
      const dbError = new Error('Database connection failed');
      userService.findById.mockRejectedValue(dbError);

      const result = await authService.validateUser(jwtPayload);

      expect(result).toBeNull();
    });
  });

  describe('getTokenExpirationTime', () => {
    it('should convert hours to seconds', () => {
      configService.get.mockReturnValue('24h');

      // Access private method via bracket notation for testing
      const result = authService['getTokenExpirationTime']();

      expect(result).toBe(86400); // 24 * 3600
    });

    it('should convert minutes to seconds', () => {
      configService.get.mockReturnValue('30m');

      const result = authService['getTokenExpirationTime']();

      expect(result).toBe(1800); // 30 * 60
    });

    it('should convert days to seconds', () => {
      configService.get.mockReturnValue('7d');

      const result = authService['getTokenExpirationTime']();

      expect(result).toBe(604800); // 7 * 86400
    });

    it('should handle seconds without unit', () => {
      configService.get.mockReturnValue('3600');

      const result = authService['getTokenExpirationTime']();

      expect(result).toBe(3600);
    });

    it('should return default when config is invalid', () => {
      configService.get.mockReturnValue('invalid');

      const result = authService['getTokenExpirationTime']();

      expect(result).toBe(86400); // Default 24 hours
    });

    it('should return default when config is undefined', () => {
      configService.get.mockReturnValue(undefined);

      const result = authService['getTokenExpirationTime']();

      expect(result).toBe(86400); // Default 24 hours
    });
  });
});
