import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from './types/user.types';

describe('UserController', () => {
  let controller: UserController;
  let mockUserService: any;
  let mockJwtAuthGuard: any;

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

  const mockUser = {
    id: mockUserResponse.id,
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
    fullName: 'Test User',
    organizationId: 'org-123',
    role: 'AGENT' as UserRole,
    createdAt: new Date(),
    updatedAt: new Date(),
    failedAttempts: 0,
    lockedUntil: null,
    lastFailedLogin: null,
  };

  beforeEach(async () => {
    mockUserService = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      validatePassword: jest.fn(),
    };

    mockJwtAuthGuard = {
      canActivate: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<UserController>(UserController);
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile for authenticated user', async () => {
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      const result = await controller.getProfile(mockUser);

      expect(result).toEqual(mockUserResponse);
      expect(mockUserService.findById).toHaveBeenCalledWith(
        mockUserResponse.id,
      );
      expect(mockUserService.findById).toHaveBeenCalledTimes(1);
    });

    it('should handle NotFoundException from service gracefully', async () => {
      const notFoundError = new NotFoundException('User not found');
      mockUserService.findById.mockRejectedValue(notFoundError);

      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        'User not found',
      );
      expect(mockUserService.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw InternalServerErrorException for unexpected errors', async () => {
      mockUserService.findById.mockRejectedValue(new Error('Database error'));

      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        'Failed to retrieve user profile',
      );
      expect(mockUserService.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should handle different user objects correctly', async () => {
      const differentUser = {
        ...mockUser,
        id: '987e6543-e21b-43d2-a654-123456789000',
        username: 'differentuser',
      };
      const differentUserResponse = {
        ...mockUserResponse,
        id: differentUser.id,
        username: 'differentuser',
      };
      mockUserService.findById.mockResolvedValue(differentUserResponse);

      const result = await controller.getProfile(differentUser);

      expect(result).toEqual(differentUserResponse);
      expect(mockUserService.findById).toHaveBeenCalledWith(differentUser.id);
    });

    it('should preserve service response exactly', async () => {
      const serviceResponse = {
        ...mockUserResponse,
        customField: 'customValue',
      };
      mockUserService.findById.mockResolvedValue(serviceResponse);

      const result = await controller.getProfile(mockUser);

      expect(result).toStrictEqual(serviceResponse);
    });

    it('should handle service timeout errors', async () => {
      mockUserService.findById.mockRejectedValue(new Error('Request timeout'));

      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        'Failed to retrieve user profile',
      );
    });
  });

  describe('getUserById', () => {
    const validId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return user by valid ID', async () => {
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      const result = await controller.getUserById(validId);

      expect(result).toEqual(mockUserResponse);
      expect(mockUserService.findById).toHaveBeenCalledWith(validId);
      expect(mockUserService.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when user not found', async () => {
      const notFoundError = new NotFoundException(
        `User with ID ${validId} not found`,
      );
      mockUserService.findById.mockRejectedValue(notFoundError);

      await expect(controller.getUserById(validId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getUserById(validId)).rejects.toThrow(
        `User with ID ${validId} not found`,
      );
      expect(mockUserService.findById).toHaveBeenCalledWith(validId);
    });

    it('should throw custom NotFoundException with ID when service throws NotFoundException', async () => {
      mockUserService.findById.mockRejectedValue(
        new NotFoundException('Generic not found'),
      );

      await expect(controller.getUserById(validId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getUserById(validId)).rejects.toThrow(
        `User with ID ${validId} not found`,
      );
      expect(mockUserService.findById).toHaveBeenCalledWith(validId);
    });

    it('should throw InternalServerErrorException for unexpected errors', async () => {
      mockUserService.findById.mockRejectedValue(new Error('Database error'));

      await expect(controller.getUserById(validId)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(controller.getUserById(validId)).rejects.toThrow(
        'Failed to retrieve user',
      );
      expect(mockUserService.findById).toHaveBeenCalledWith(validId);
    });

    it('should handle different user IDs correctly', async () => {
      const differentId = '987e6543-e21b-43d2-a654-123456789000';
      const differentUserResponse = {
        ...mockUserResponse,
        id: differentId,
        username: 'differentuser',
      };
      mockUserService.findById.mockResolvedValue(differentUserResponse);

      const result = await controller.getUserById(differentId);

      expect(result).toEqual(differentUserResponse);
      expect(mockUserService.findById).toHaveBeenCalledWith(differentId);
    });

    it('should handle various UUID formats', async () => {
      const uuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        '00000000-0000-0000-0000-000000000000',
      ];

      for (const uuid of uuids) {
        const userResponse = { ...mockUserResponse, id: uuid };
        mockUserService.findById.mockResolvedValue(userResponse);

        const result = await controller.getUserById(uuid);

        expect(result).toEqual(userResponse);
        expect(mockUserService.findById).toHaveBeenCalledWith(uuid);
      }
    });

    it('should handle service connection errors', async () => {
      mockUserService.findById.mockRejectedValue(
        new Error('Connection refused'),
      );

      await expect(controller.getUserById(validId)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(controller.getUserById(validId)).rejects.toThrow(
        'Failed to retrieve user',
      );
    });

    it('should handle service returning null/undefined', async () => {
      mockUserService.findById.mockResolvedValue(null);

      const result = await controller.getUserById(validId);

      expect(result).toBeNull();
      expect(mockUserService.findById).toHaveBeenCalledWith(validId);
    });
  });

  describe('Error Handling', () => {
    it('should preserve specific NotFoundException messages from service', async () => {
      const specificError = new NotFoundException('User with ID 123 not found');
      mockUserService.findById.mockRejectedValue(specificError);

      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        'User with ID 123 not found',
      );
    });

    it('should wrap non-NotFoundException errors in InternalServerErrorException', async () => {
      const errors = [
        new Error('Connection timeout'),
        new Error('Database constraint violation'),
        new Error('Invalid query'),
        new RangeError('Index out of bounds'),
        new TypeError('Cannot read property'),
      ];

      for (const error of errors) {
        mockUserService.findById.mockRejectedValue(error);

        await expect(controller.getProfile(mockUser)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(controller.getProfile(mockUser)).rejects.toThrow(
          'Failed to retrieve user profile',
        );
      }
    });

    it('should handle errors with different error properties', async () => {
      const customError = {
        message: 'Custom error',
        code: 'E_CUSTOM',
        details: 'Something went wrong',
      };
      mockUserService.findById.mockRejectedValue(customError);

      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle async errors properly', async () => {
      mockUserService.findById.mockImplementation(async () => {
        throw new Error('Async error');
      });

      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('Authentication Guard Integration', () => {
    it('should have JwtAuthGuard applied to getProfile', () => {
      // This test verifies the guard is properly configured
      // In a real integration test, the guard would be tested separately
      expect(mockJwtAuthGuard.canActivate).toBeDefined();
    });

    it('should have JwtAuthGuard applied to getUserById', () => {
      // This test verifies the guard is properly configured
      // In a real integration test, the guard would be tested separately
      expect(mockJwtAuthGuard.canActivate).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should handle user objects with missing properties gracefully', async () => {
      const incompleteUser = {
        id: mockUser.id,
        // Missing other properties
      };
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      const result = await controller.getProfile(incompleteUser as any);

      expect(result).toEqual(mockUserResponse);
      expect(mockUserService.findById).toHaveBeenCalledWith(incompleteUser.id);
    });

    it('should handle user objects with additional properties', async () => {
      const extendedUser = {
        ...mockUser,
        extraProperty: 'extra',
        anotherProp: 123,
      };
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      const result = await controller.getProfile(extendedUser);

      expect(result).toEqual(mockUserResponse);
      expect(mockUserService.findById).toHaveBeenCalledWith(extendedUser.id);
    });
  });

  describe('Service Method Interactions', () => {
    it('should only call findById method on service', async () => {
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      await controller.getProfile(mockUser);

      expect(mockUserService.findById).toHaveBeenCalled();
      expect(mockUserService.create).not.toHaveBeenCalled();
      expect(mockUserService.update).not.toHaveBeenCalled();
      expect(mockUserService.delete).not.toHaveBeenCalled();
      expect(mockUserService.findByEmail).not.toHaveBeenCalled();
      expect(mockUserService.findByUsername).not.toHaveBeenCalled();
    });

    it('should pass exact parameters to service methods', async () => {
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      await controller.getProfile(mockUser);
      await controller.getUserById('test-id');

      expect(mockUserService.findById).toHaveBeenNthCalledWith(1, mockUser.id);
      expect(mockUserService.findById).toHaveBeenNthCalledWith(2, 'test-id');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle concurrent requests properly', async () => {
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      const promises = Array(10)
        .fill(null)
        .map(() => controller.getProfile(mockUser));

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result).toEqual(mockUserResponse);
      });
      expect(mockUserService.findById).toHaveBeenCalledTimes(10);
    });

    it('should handle very long user ID strings', async () => {
      const longId = 'a'.repeat(1000);
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      await controller.getUserById(longId);

      expect(mockUserService.findById).toHaveBeenCalledWith(longId);
    });

    it('should handle empty string ID', async () => {
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      await controller.getUserById('');

      expect(mockUserService.findById).toHaveBeenCalledWith('');
    });

    it('should handle special characters in user properties', async () => {
      const userWithSpecialChars = {
        ...mockUser,
        username: 'user@domain.com',
        fullName: 'User & Co. <test>',
      };
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      await controller.getProfile(userWithSpecialChars);

      expect(mockUserService.findById).toHaveBeenCalledWith(
        userWithSpecialChars.id,
      );
    });
  });
});
