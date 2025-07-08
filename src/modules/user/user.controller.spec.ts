import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserResponseDto } from './dto/user-response.dto';

describe('UserController', () => {
  let controller: UserController;
  let mockUserService: any;

  const mockUserResponse: UserResponseDto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

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
    });

    it('should handle service errors gracefully', async () => {
      mockUserService.findById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserService.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw InternalServerErrorException for unexpected errors', async () => {
      mockUserService.findById.mockRejectedValue(new Error('Database error'));

      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockUserService.findById).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('getUserById', () => {
    const validId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return user by valid ID', async () => {
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      const result = await controller.getUserById(validId);

      expect(result).toEqual(mockUserResponse);
      expect(mockUserService.findById).toHaveBeenCalledWith(validId);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.findById.mockRejectedValue(
        new NotFoundException(`User with ID ${validId} not found`),
      );

      await expect(controller.getUserById(validId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserService.findById).toHaveBeenCalledWith(validId);
    });

    it('should throw InternalServerErrorException for unexpected errors', async () => {
      mockUserService.findById.mockRejectedValue(new Error('Database error'));

      await expect(controller.getUserById(validId)).rejects.toThrow(
        InternalServerErrorException,
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
  });

  describe('Error Handling', () => {
    it('should preserve specific error messages', async () => {
      const specificError = new NotFoundException('User with ID 123 not found');
      mockUserService.findById.mockRejectedValue(specificError);

      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        'User with ID 123 not found',
      );
    });

    it('should wrap non-NotFound errors in InternalServerErrorException', async () => {
      mockUserService.findById.mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
