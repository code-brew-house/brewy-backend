import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { IUser } from './types/user.types';
import { PasswordUtil } from '../../common/utils/password.util';

// Mock the PasswordUtil
jest.mock('../../common/utils/password.util');

describe('UserService', () => {
  let service: UserService;
  let mockPrisma: any;

  const mockUser: IUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword123',
    fullName: 'Test User',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockCreateUserDto: CreateUserDto = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password123!',
    fullName: 'Test User',
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();

    // Mock PasswordUtil methods
    (PasswordUtil.hashPassword as jest.Mock).mockResolvedValue(
      'hashedpassword123',
    );
    (PasswordUtil.comparePassword as jest.Mock).mockResolvedValue(true);
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // No existing email
        .mockResolvedValueOnce(null); // No existing username
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await service.create(mockCreateUserDto);

      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.username).toBe(mockCreateUserDto.username);
      expect(result.email).toBe(mockCreateUserDto.email);
      expect(PasswordUtil.hashPassword).toHaveBeenCalledWith(
        mockCreateUserDto.password,
      );
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          username: mockCreateUserDto.username,
          email: mockCreateUserDto.email,
          password: 'hashedpassword123',
          fullName: mockCreateUserDto.fullName,
        },
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser); // Email exists

      await expect(service.create(mockCreateUserDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if username already exists', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // No existing email
        .mockResolvedValueOnce(mockUser); // Username exists

      await expect(service.create(mockCreateUserDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on database error', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.user.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(mockCreateUserDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException on password hashing error', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (PasswordUtil.hashPassword as jest.Mock).mockRejectedValue(
        new Error('Hash error'),
      );

      await expect(service.create(mockCreateUserDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user if found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException on database error', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.findByEmail('test@example.com')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findByUsername', () => {
    it('should return user if found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByUsername('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException on database error', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.findByUsername('testuser')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id);

      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.id).toBe(mockUser.id);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on database error', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.findById(mockUser.id)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('update', () => {
    const updateData = { fullName: 'Updated Name' };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, fullName: 'Updated Name' };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(mockUser.id, updateData);

      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.fullName).toBe('Updated Name');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: updateData,
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      const error: any = new Error('Record not found');
      error.code = 'P2025';
      mockPrisma.user.update.mockRejectedValue(error);

      await expect(
        service.update('nonexistent-id', updateData),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on other database errors', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('Database error'));

      await expect(service.update(mockUser.id, updateData)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      await service.delete(mockUser.id);

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      const error: any = new Error('Record not found');
      error.code = 'P2025';
      mockPrisma.user.delete.mockRejectedValue(error);

      await expect(service.delete('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on other database errors', async () => {
      mockPrisma.user.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.delete(mockUser.id)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid password', async () => {
      (PasswordUtil.comparePassword as jest.Mock).mockResolvedValue(true);

      const result = await service.validatePassword(
        mockUser,
        'correctpassword',
      );

      expect(result).toBe(true);
      expect(PasswordUtil.comparePassword).toHaveBeenCalledWith(
        'correctpassword',
        mockUser.password,
      );
    });

    it('should return false for invalid password', async () => {
      (PasswordUtil.comparePassword as jest.Mock).mockResolvedValue(false);

      const result = await service.validatePassword(mockUser, 'wrongpassword');

      expect(result).toBe(false);
    });

    it('should throw InternalServerErrorException on password comparison error', async () => {
      (PasswordUtil.comparePassword as jest.Mock).mockRejectedValue(
        new Error('Comparison error'),
      );

      await expect(
        service.validatePassword(mockUser, 'password'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string inputs gracefully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('');
      expect(result).toBeNull();

      const result2 = await service.findByUsername('');
      expect(result2).toBeNull();
    });

    it('should handle malformed UUIDs in findById', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('invalid-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle concurrent creation attempts', async () => {
      // Simulate race condition where user is created between validation and creation
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // No existing email during validation
        .mockResolvedValueOnce(null); // No existing username during validation

      const uniqueConstraintError: any = new Error('Unique constraint failed');
      uniqueConstraintError.code = 'P2002';
      mockPrisma.user.create.mockRejectedValue(uniqueConstraintError);

      await expect(service.create(mockCreateUserDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle very long input strings', async () => {
      const longString = 'a'.repeat(1000);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail(longString);
      expect(result).toBeNull();
    });
  });
});
