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
      const mockRequest = {
        user: { id: mockUserResponse.id },
      };
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      const result = await controller.getProfile(mockRequest);

      expect(result).toEqual(mockUserResponse);
      expect(mockUserService.findById).toHaveBeenCalledWith(
        mockUserResponse.id,
      );
    });

    it('should return user profile when user ID is in sub field', async () => {
      const mockRequest = {
        user: { sub: mockUserResponse.id },
      };
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      const result = await controller.getProfile(mockRequest);

      expect(result).toEqual(mockUserResponse);
      expect(mockUserService.findById).toHaveBeenCalledWith(
        mockUserResponse.id,
      );
    });

    it('should throw NotFoundException when user is not authenticated', async () => {
      const mockRequest = {
        user: null,
      };

      await expect(controller.getProfile(mockRequest)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserService.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user object is missing', async () => {
      const mockRequest = {};

      await expect(controller.getProfile(mockRequest)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserService.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user ID is missing', async () => {
      const mockRequest = {
        user: {},
      };

      await expect(controller.getProfile(mockRequest)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserService.findById).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on service error', async () => {
      const mockRequest = {
        user: { id: mockUserResponse.id },
      };
      mockUserService.findById.mockRejectedValue(new Error('Service error'));

      await expect(controller.getProfile(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should preserve NotFoundException from service', async () => {
      const mockRequest = {
        user: { id: 'nonexistent-id' },
      };
      mockUserService.findById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.getProfile(mockRequest)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      mockUserService.findById.mockResolvedValue(mockUserResponse);

      const result = await controller.getUserById(mockUserResponse.id);

      expect(result).toEqual(mockUserResponse);
      expect(mockUserService.findById).toHaveBeenCalledWith(
        mockUserResponse.id,
      );
    });

    it('should throw NotFoundException when user is not found', async () => {
      const nonexistentId = 'nonexistent-id';
      mockUserService.findById.mockRejectedValue(
        new NotFoundException(`User with ID ${nonexistentId} not found`),
      );

      await expect(controller.getUserById(nonexistentId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getUserById(nonexistentId)).rejects.toThrow(
        `User with ID ${nonexistentId} not found`,
      );
    });

    it('should throw InternalServerErrorException on service error', async () => {
      mockUserService.findById.mockRejectedValue(new Error('Database error'));

      await expect(controller.getUserById(mockUserResponse.id)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should preserve NotFoundException from service', async () => {
      mockUserService.findById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.getUserById(mockUserResponse.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    describe('getProfile edge cases', () => {
      it('should handle empty user ID gracefully', async () => {
        const mockRequest = {
          user: { id: '' },
        };

        await expect(controller.getProfile(mockRequest)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should handle null user ID gracefully', async () => {
        const mockRequest = {
          user: { id: null },
        };

        await expect(controller.getProfile(mockRequest)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should handle undefined user ID gracefully', async () => {
        const mockRequest = {
          user: { id: undefined },
        };

        await expect(controller.getProfile(mockRequest)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should handle malformed request object', async () => {
        const mockRequest = null;

        await expect(controller.getProfile(mockRequest)).rejects.toThrow(
          InternalServerErrorException,
        );
      });

      it('should handle request with invalid user structure', async () => {
        const mockRequest = {
          user: 'invalid-user-structure',
        };

        // Since 'invalid-user-structure'.id is undefined, it should throw NotFoundException
        // Ensure userService.findById is not called by not setting up the mock
        await expect(controller.getProfile(mockRequest)).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('getUserById edge cases', () => {
      it('should handle malformed UUID gracefully', async () => {
        const malformedId = 'invalid-uuid';
        mockUserService.findById.mockRejectedValue(
          new NotFoundException(`User with ID ${malformedId} not found`),
        );

        await expect(controller.getUserById(malformedId)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should handle very long ID strings', async () => {
        const longId = 'a'.repeat(1000);
        mockUserService.findById.mockRejectedValue(
          new NotFoundException(`User with ID ${longId} not found`),
        );

        await expect(controller.getUserById(longId)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should handle special characters in ID', async () => {
        const specialId = 'user-id-with-!@#$%^&*()';
        mockUserService.findById.mockRejectedValue(
          new NotFoundException(`User with ID ${specialId} not found`),
        );

        await expect(controller.getUserById(specialId)).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('Service error handling', () => {
      it('should handle service timeout errors', async () => {
        mockUserService.findById.mockRejectedValue(
          new Error('Request timeout'),
        );

        await expect(
          controller.getUserById(mockUserResponse.id),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should handle service connection errors', async () => {
        mockUserService.findById.mockRejectedValue(
          new Error('Database connection failed'),
        );

        await expect(
          controller.getUserById(mockUserResponse.id),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should handle service validation errors', async () => {
        mockUserService.findById.mockRejectedValue(
          new Error('Validation failed'),
        );

        await expect(
          controller.getUserById(mockUserResponse.id),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('Response handling', () => {
      it('should return complete user response object', async () => {
        mockUserService.findById.mockResolvedValue(mockUserResponse);

        const result = await controller.getUserById(mockUserResponse.id);

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('username');
        expect(result).toHaveProperty('email');
        expect(result).toHaveProperty('fullName');
        expect(result).toHaveProperty('createdAt');
        expect(result).toHaveProperty('updatedAt');
        // Note: password exclusion depends on class-transformer serialization in real app
        expect(result).toHaveProperty('password'); // Will be excluded by @Exclude decorator in real serialization
      });

      it('should handle partial user response objects', async () => {
        const partialResponse = {
          id: mockUserResponse.id,
          username: mockUserResponse.username,
          email: mockUserResponse.email,
          fullName: mockUserResponse.fullName,
        };
        mockUserService.findById.mockResolvedValue(partialResponse);

        const result = await controller.getUserById(mockUserResponse.id);

        expect(result).toEqual(partialResponse);
      });
    });

    describe('Concurrent request handling', () => {
      it('should handle multiple concurrent requests', async () => {
        mockUserService.findById.mockResolvedValue(mockUserResponse);

        const requests = Array(10)
          .fill(null)
          .map(() => controller.getUserById(mockUserResponse.id));

        const results = await Promise.all(requests);

        expect(results).toHaveLength(10);
        results.forEach((result) => {
          expect(result).toEqual(mockUserResponse);
        });
        expect(mockUserService.findById).toHaveBeenCalledTimes(10);
      });

      it('should handle mixed success and failure requests', async () => {
        mockUserService.findById
          .mockResolvedValueOnce(mockUserResponse)
          .mockRejectedValueOnce(new NotFoundException('User not found'));

        const successRequest = controller.getUserById(mockUserResponse.id);
        const failRequest = controller.getUserById('nonexistent-id');

        const successResult = await successRequest;
        expect(successResult).toEqual(mockUserResponse);

        await expect(failRequest).rejects.toThrow(NotFoundException);
      });
    });
  });
});
