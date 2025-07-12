import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtValidationService } from './services/jwt-validation.service';
import {
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserResponseDto } from '../user/dto/user-response.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;

  const mockRequest = {
    ip: '127.0.0.1',
    get: jest.fn((header: string) => {
      if (header === 'User-Agent') return 'test-agent';
      return undefined;
    }),
  };

  const mockUserResponse: UserResponseDto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    organizationId: 'org-123',
    role: 'AGENT',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    password: 'should-be-excluded',
  };

  const mockAuthResponse = new AuthResponseDto(
    'Login successful',
    mockUserResponse,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
    86400,
    {
      id: 'org-123',
      name: 'Test Organization',
      role: 'AGENT',
    },
  );

  const validRegisterDto: RegisterDto = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password123!',
    fullName: 'Test User',
  };

  const validLoginDto: LoginDto = {
    identifier: 'test@example.com',
    password: 'Password123!',
  };

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      validateUser: jest.fn(),
    };

    const mockJwtValidationService = {
      extractTokenFromHeader: jest.fn(),
      validateToken: jest.fn(),
      getTokenExpiration: jest.fn(),
      getTokenIssuedAt: jest.fn(),
      isTokenExpiringSoon: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: JwtValidationService,
          useValue: mockJwtValidationService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(validRegisterDto, mockRequest);

      expect(result).toEqual(mockAuthResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(
        validRegisterDto,
        '127.0.0.1',
        'test-agent',
      );
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException with generic message when user already exists', async () => {
      mockAuthService.register.mockRejectedValue(
        new ConflictException('User already exists'),
      );

      await expect(
        controller.register(validRegisterDto, mockRequest),
      ).rejects.toThrow(ConflictException);
      await expect(
        controller.register(validRegisterDto, mockRequest),
      ).rejects.toThrow('Registration failed - user may already exist');
      expect(mockAuthService.register).toHaveBeenCalledWith(
        validRegisterDto,
        '127.0.0.1',
        'test-agent',
      );
    });

    it('should throw InternalServerErrorException on unexpected service error', async () => {
      mockAuthService.register.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        controller.register(validRegisterDto, mockRequest),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        controller.register(validRegisterDto, mockRequest),
      ).rejects.toThrow('Registration failed');
      expect(mockAuthService.register).toHaveBeenCalledWith(
        validRegisterDto,
        '127.0.0.1',
        'test-agent',
      );
    });

    it('should preserve ConflictException from service', async () => {
      const conflictError = new ConflictException('Email already in use');
      mockAuthService.register.mockRejectedValue(conflictError);

      await expect(
        controller.register(validRegisterDto, mockRequest),
      ).rejects.toThrow(ConflictException);
      // Should throw generic message for security
      await expect(
        controller.register(validRegisterDto, mockRequest),
      ).rejects.toThrow('Registration failed - user may already exist');
    });

    it('should handle service timeout errors', async () => {
      mockAuthService.register.mockRejectedValue(new Error('Request timeout'));

      await expect(
        controller.register(validRegisterDto, mockRequest),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(validLoginDto, mockRequest);

      expect(result).toEqual(mockAuthResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        validLoginDto,
        '127.0.0.1',
        'test-agent',
      );
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException with generic message for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('User not found'),
      );

      await expect(
        controller.login(validLoginDto, mockRequest),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.login(validLoginDto, mockRequest),
      ).rejects.toThrow('Invalid credentials');
      expect(mockAuthService.login).toHaveBeenCalledWith(
        validLoginDto,
        '127.0.0.1',
        'test-agent',
      );
    });

    it('should throw InternalServerErrorException on unexpected service error', async () => {
      mockAuthService.login.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        controller.login(validLoginDto, mockRequest),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        controller.login(validLoginDto, mockRequest),
      ).rejects.toThrow('Login failed');
      expect(mockAuthService.login).toHaveBeenCalledWith(
        validLoginDto,
        '127.0.0.1',
        'test-agent',
      );
    });

    it('should preserve UnauthorizedException from service', async () => {
      const unauthorizedError = new UnauthorizedException('Invalid password');
      mockAuthService.login.mockRejectedValue(unauthorizedError);

      await expect(
        controller.login(validLoginDto, mockRequest),
      ).rejects.toThrow(UnauthorizedException);
      // Should throw generic message for security
      await expect(
        controller.login(validLoginDto, mockRequest),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle service validation errors', async () => {
      mockAuthService.login.mockRejectedValue(
        new Error('Password validation failed'),
      );

      await expect(
        controller.login(validLoginDto, mockRequest),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('logout', () => {
    it('should successfully logout authenticated user', async () => {
      const mockRequest = {
        user: { id: mockUserResponse.id },
      };
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(mockRequest);

      expect(result).toEqual({ message: 'Logout successful' });
      expect(mockAuthService.logout).toHaveBeenCalledWith(mockUserResponse.id);
      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const mockRequest = {
        user: null,
      };

      await expect(controller.logout(mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(controller.logout(mockRequest)).rejects.toThrow(
        'User not authenticated',
      );
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user object is missing', async () => {
      const mockRequest = {};

      await expect(controller.logout(mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user ID is missing', async () => {
      const mockRequest = {
        user: {},
      };

      await expect(controller.logout(mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on service error', async () => {
      const mockRequest = {
        user: { id: mockUserResponse.id },
      };
      mockAuthService.logout.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.logout(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(controller.logout(mockRequest)).rejects.toThrow(
        'Logout failed',
      );
    });

    it('should preserve UnauthorizedException from service', async () => {
      const mockRequest = {
        user: { id: mockUserResponse.id },
      };
      const unauthorizedError = new UnauthorizedException('Token expired');
      mockAuthService.logout.mockRejectedValue(unauthorizedError);

      await expect(controller.logout(mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    describe('register edge cases', () => {
      it('should handle malformed register data', async () => {
        const malformedData = {
          username: '',
          email: 'invalid-email',
          password: '123',
          fullName: '',
        } as RegisterDto;

        mockAuthService.register.mockRejectedValue(
          new Error('Validation failed'),
        );

        await expect(
          controller.register(malformedData, {} as any),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should handle register with null data', async () => {
        const nullData = null as any;

        // This would normally be caught by ValidationPipe, but testing controller directly
        // Mock the service to reject for invalid data
        mockAuthService.register.mockRejectedValue(
          new Error('Validation failed'),
        );

        await expect(
          controller.register(nullData, {} as any),
        ).rejects.toThrow();
      });

      it('should handle register with undefined data', async () => {
        const undefinedData = undefined as any;

        // Mock the service to reject for invalid data
        mockAuthService.register.mockRejectedValue(
          new Error('Validation failed'),
        );

        await expect(
          controller.register(undefinedData, {} as any),
        ).rejects.toThrow();
      });
    });

    describe('login edge cases', () => {
      it('should handle malformed login data', async () => {
        const malformedData = {
          identifier: '',
          password: '',
        } as LoginDto;

        mockAuthService.login.mockRejectedValue(
          new UnauthorizedException('Invalid credentials'),
        );

        await expect(
          controller.login(malformedData, {
            ip: '127.0.0.1',
            get: () => 'test-agent',
          } as any),
        ).rejects.toThrow('Invalid credentials');
      });

      it('should handle login with null data', async () => {
        const nullData = null as any;

        // Mock the service to reject for invalid data
        mockAuthService.login.mockRejectedValue(new Error('Validation failed'));

        await expect(controller.login(nullData, {} as any)).rejects.toThrow();
      });

      it('should handle login with special characters', async () => {
        const specialData = {
          identifier: 'test@example.com',
          password: 'password!@#$%^&*()',
        } as LoginDto;

        mockAuthService.login.mockResolvedValue(mockAuthResponse);

        const result = await controller.login(specialData, {
          ip: '127.0.0.1',
          get: () => 'test-agent',
        } as any);

        expect(result).toEqual(mockAuthResponse);
        expect(mockAuthService.login).toHaveBeenCalledWith(
          specialData,
          '127.0.0.1',
          'test-agent',
        );
      });
    });

    describe('logout edge cases', () => {
      it('should handle empty user ID gracefully', async () => {
        const mockRequest = {
          user: { id: '' },
        };

        await expect(controller.logout(mockRequest)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should handle null user ID gracefully', async () => {
        const mockRequest = {
          user: { id: null },
        };

        await expect(controller.logout(mockRequest)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should handle undefined user ID gracefully', async () => {
        const mockRequest = {
          user: { id: undefined },
        };

        await expect(controller.logout(mockRequest)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should handle malformed request object', async () => {
        const mockRequest = null;

        await expect(controller.logout(mockRequest)).rejects.toThrow(
          InternalServerErrorException,
        );
      });

      it('should handle request with invalid user structure', async () => {
        const mockRequest = {
          user: 'invalid-user-structure',
        };

        await expect(controller.logout(mockRequest)).rejects.toThrow(
          UnauthorizedException,
        );
      });
    });

    describe('Service error handling', () => {
      it('should handle service timeout errors for all endpoints', async () => {
        const timeoutError = new Error('Request timeout');

        mockAuthService.register.mockRejectedValue(timeoutError);
        mockAuthService.login.mockRejectedValue(timeoutError);
        mockAuthService.logout.mockRejectedValue(timeoutError);

        await expect(
          controller.register(validRegisterDto, mockRequest),
        ).rejects.toThrow(InternalServerErrorException);

        await expect(
          controller.login(validLoginDto, mockRequest),
        ).rejects.toThrow(InternalServerErrorException);

        const mockLogoutRequest1 = { user: { id: mockUserResponse.id } };
        await expect(controller.logout(mockLogoutRequest1)).rejects.toThrow(
          InternalServerErrorException,
        );
      });

      it('should handle service connection errors for all endpoints', async () => {
        const connectionError = new Error('Database connection failed');

        mockAuthService.register.mockRejectedValue(connectionError);
        mockAuthService.login.mockRejectedValue(connectionError);
        mockAuthService.logout.mockRejectedValue(connectionError);

        await expect(
          controller.register(validRegisterDto, mockRequest),
        ).rejects.toThrow(InternalServerErrorException);

        await expect(
          controller.login(validLoginDto, mockRequest),
        ).rejects.toThrow(InternalServerErrorException);

        const mockLogoutRequest2 = { user: { id: mockUserResponse.id } };
        await expect(controller.logout(mockLogoutRequest2)).rejects.toThrow(
          InternalServerErrorException,
        );
      });
    });

    describe('Response handling', () => {
      it('should return complete auth response object for register', async () => {
        mockAuthService.register.mockResolvedValue(mockAuthResponse);

        const result = await controller.register(validRegisterDto, mockRequest);

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('token');
        expect(result.data).toHaveProperty('tokenType');
        expect(result.data).toHaveProperty('expiresIn');
        expect(result.data).toHaveProperty('user');
        expect(result.data.user).toHaveProperty('id');
        expect(result.data.user).toHaveProperty('username');
        expect(result.data.user).toHaveProperty('email');
        expect(result.data.user).toHaveProperty('fullName');
      });

      it('should return complete auth response object for login', async () => {
        mockAuthService.login.mockResolvedValue(mockAuthResponse);

        const result = await controller.login(validLoginDto, mockRequest);

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('token');
        expect(result.data).toHaveProperty('tokenType');
        expect(result.data).toHaveProperty('expiresIn');
        expect(result.data).toHaveProperty('user');
        expect(result.data.tokenType).toBe('Bearer');
      });

      it('should return proper logout response', async () => {
        const mockRequest = { user: { id: mockUserResponse.id } };
        mockAuthService.logout.mockResolvedValue(undefined);

        const result = await controller.logout(mockRequest);

        expect(result).toEqual({ message: 'Logout successful' });
        expect(result).toHaveProperty('message');
      });
    });

    describe('Concurrent request handling', () => {
      it('should handle multiple concurrent register requests', async () => {
        mockAuthService.register.mockResolvedValue(mockAuthResponse);

        const requests = Array(5)
          .fill(null)
          .map(() => controller.register(validRegisterDto, mockRequest));

        const results = await Promise.all(requests);

        expect(results).toHaveLength(5);
        results.forEach((result) => {
          expect(result).toEqual(mockAuthResponse);
        });
        expect(mockAuthService.register).toHaveBeenCalledTimes(5);
      });

      it('should handle multiple concurrent login requests', async () => {
        mockAuthService.login.mockResolvedValue(mockAuthResponse);

        const requests = Array(5)
          .fill(null)
          .map(() => controller.login(validLoginDto, mockRequest));

        const results = await Promise.all(requests);

        expect(results).toHaveLength(5);
        results.forEach((result) => {
          expect(result).toEqual(mockAuthResponse);
        });
        expect(mockAuthService.login).toHaveBeenCalledTimes(5);
      });

      it('should handle mixed success and failure requests', async () => {
        mockAuthService.register
          .mockResolvedValueOnce(mockAuthResponse)
          .mockRejectedValueOnce(new ConflictException('User already exists'));

        const successRequest = controller.register(
          validRegisterDto,
          mockRequest,
        );
        const failRequest = controller.register(validRegisterDto, mockRequest);

        const successResult = await successRequest;
        expect(successResult).toEqual(mockAuthResponse);

        await expect(failRequest).rejects.toThrow(ConflictException);
      });
    });
  });
});
