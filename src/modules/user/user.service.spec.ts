import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import {
  UserLimitExceededException,
  OrganizationNotFoundForLimitException,
} from '../organization/exceptions/organization-limits.exception';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { IUser, ICreateUser } from './types/user.types';
import { PasswordUtil } from '../../common/utils/password.util';

// Mock the PasswordUtil
jest.mock('../../common/utils/password.util');

describe('UserService', () => {
  let service: UserService;
  let mockPrisma: any;

  const mockOrganization = {
    id: 'org-123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Organization',
    email: 'org@example.com',
    totalMemberCount: 1,
    maxUsers: 50,
  };

  const mockUser: IUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword123',
    fullName: 'Test User',
    organizationId: mockOrganization.id,
    role: 'ADMIN',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockAnotherOrgUser: IUser = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    username: 'anotheruser',
    email: 'another@example.com',
    password: 'hashedpassword123',
    fullName: 'Another User',
    organizationId: 'org-different',
    role: 'AGENT',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockCreateUserDto: CreateUserDto = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password123!',
    fullName: 'Test User',
  };

  const mockCreateUserData: ICreateUser = {
    ...mockCreateUserDto,
    organizationId: mockOrganization.id,
    role: 'AGENT',
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
        update: jest.fn(),
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
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.user.count.mockResolvedValue(1); // Current user count
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.organization.update.mockResolvedValue({
        ...mockOrganization,
        totalMemberCount: 2,
      });

      const result = await service.create(mockCreateUserData);

      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.username).toBe(mockCreateUserData.username);
      expect(result.email).toBe(mockCreateUserData.email);
      expect(PasswordUtil.hashPassword).toHaveBeenCalledWith(
        mockCreateUserData.password,
      );
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          username: mockCreateUserData.username,
          email: mockCreateUserData.email,
          password: 'hashedpassword123',
          fullName: mockCreateUserData.fullName,
          organizationId: mockCreateUserData.organizationId,
          role: mockCreateUserData.role,
        },
      });
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrganization.id },
        data: { totalMemberCount: 2 },
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser); // Email exists

      await expect(service.create(mockCreateUserData)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if username already exists', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // No existing email
        .mockResolvedValueOnce(mockUser); // Username exists

      await expect(service.create(mockCreateUserData)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if organization not found', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // No existing email
        .mockResolvedValueOnce(null); // No existing username
      mockPrisma.organization.findUnique.mockResolvedValue(null); // Organization not found

      await expect(service.create(mockCreateUserData)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should enforce role-based creation rules', async () => {
      const adminCreateData = {
        ...mockCreateUserData,
        role: 'ADMIN' as const,
      };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);

      await expect(service.create(adminCreateData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw UserLimitExceededException when user limit is exceeded', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.organization.findUnique.mockResolvedValue({
        ...mockOrganization,
        totalMemberCount: 50, // At max limit
        maxUsers: 50,
      });

      await expect(service.create(mockCreateUserData)).rejects.toThrow(
        UserLimitExceededException,
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw OrganizationNotFoundForLimitException when organization not found during limit check', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce(null) // Organization not found for initial check
        .mockResolvedValueOnce(null); // Organization not found for limit check

      await expect(service.create(mockCreateUserData)).rejects.toThrow(
        OrganizationNotFoundForLimitException,
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should use default limit when organization maxUsers is null', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.organization.findUnique.mockResolvedValue({
        ...mockOrganization,
        totalMemberCount: 10, // At default limit
        maxUsers: null, // Will use default of 10
      });

      await expect(service.create(mockCreateUserData)).rejects.toThrow(
        UserLimitExceededException,
      );
    });

    it('should allow user creation when under limit', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.organization.findUnique.mockResolvedValue({
        ...mockOrganization,
        totalMemberCount: 5, // Under limit
        maxUsers: 10,
      });
      mockPrisma.user.create.mockResolvedValue({
        ...mockUser,
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });
      mockPrisma.organization.update.mockResolvedValue(mockOrganization);

      const result = await service.create(mockCreateUserData);

      expect(result).toBeInstanceOf(UserResponseDto);
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on database error', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(mockCreateUserData)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException on password hashing error', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      (PasswordUtil.hashPassword as jest.Mock).mockRejectedValue(
        new Error('Hash error'),
      );

      await expect(service.create(mockCreateUserData)).rejects.toThrow(
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

  describe('findAll', () => {
    it('should return users filtered by organization', async () => {
      const mockUsers = [mockUser];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll(mockOrganization.id);

      expect(result).toEqual(mockUsers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganization.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should prevent cross-organization data access', async () => {
      const mockUsers = [mockUser]; // Only users from the requested org
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll(mockOrganization.id);

      expect(result).toEqual(mockUsers);
      expect(result).not.toContain(mockAnotherOrgUser);
    });

    it('should throw BadRequestException if organizationId is missing', async () => {
      await expect(service.findAll('')).rejects.toThrow(BadRequestException);
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
    it('should delete user successfully and update organization count', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.count.mockResolvedValue(1); // Count after deletion would be 1
      mockPrisma.user.delete.mockResolvedValue(mockUser);
      mockPrisma.organization.update.mockResolvedValue({
        ...mockOrganization,
        totalMemberCount: 1,
      });

      await service.delete(mockUser.id);

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: mockUser.organizationId },
        data: { totalMemberCount: 1 },
      });
    });

    it('should prevent deletion of last OWNER', async () => {
      const ownerUser = { ...mockUser, role: 'OWNER' };
      mockPrisma.user.findUnique.mockResolvedValue(ownerUser);
      mockPrisma.user.count.mockResolvedValue(1); // Only one OWNER

      await expect(service.delete(ownerUser.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on other database errors', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
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

  describe('Organization Context and Data Isolation', () => {
    it('should enforce organization-scoped user queries', async () => {
      const orgAUsers = [mockUser];

      mockPrisma.user.findMany.mockResolvedValue(orgAUsers);

      const result = await service.findAll(mockOrganization.id);

      expect(result).toEqual(orgAUsers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganization.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should prevent cross-organization user access', async () => {
      // Simulate trying to access user from different organization
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.findAll('different-org-id');

      expect(result).toEqual([]);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'different-org-id' },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should validate organization membership on user creation', async () => {
      const invalidOrgData = {
        ...mockCreateUserData,
        organizationId: 'invalid-org-id',
      };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.create(invalidOrgData)).rejects.toThrow(
        BadRequestException,
      );
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
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.user.count.mockResolvedValue(1);

      const uniqueConstraintError: any = new Error('Unique constraint failed');
      uniqueConstraintError.code = 'P2002';
      mockPrisma.user.create.mockRejectedValue(uniqueConstraintError);

      await expect(service.create(mockCreateUserData)).rejects.toThrow(
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

  describe('countByOrganization', () => {
    it('should return the count of users in an organization', async () => {
      const expectedCount = 5;
      mockPrisma.user.count.mockResolvedValue(expectedCount);

      const result = await service.countByOrganization(mockOrganization.id);

      expect(result).toBe(expectedCount);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { organizationId: mockOrganization.id },
      });
    });

    it('should return 0 when no users exist in organization', async () => {
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.countByOrganization('empty-org-id');

      expect(result).toBe(0);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { organizationId: 'empty-org-id' },
      });
    });

    it('should throw InternalServerErrorException on database error', async () => {
      mockPrisma.user.count.mockRejectedValue(new Error('Database error'));

      await expect(
        service.countByOrganization(mockOrganization.id),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle invalid organization ID gracefully', async () => {
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.countByOrganization('invalid-org-id');

      expect(result).toBe(0);
    });
  });

  describe('findByOrganization', () => {
    const mockUsersWithOrg = [
      {
        ...mockUser,
        organization: { id: mockOrganization.id, name: mockOrganization.name },
      },
      {
        id: 'user-2',
        username: 'user2',
        email: 'user2@example.com',
        password: 'hashedpassword123',
        fullName: 'User Two',
        organizationId: mockOrganization.id,
        role: 'AGENT',
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        organization: { id: mockOrganization.id, name: mockOrganization.name },
      },
    ];

    it('should return users from the specified organization', async () => {
      mockPrisma.user.findMany.mockResolvedValue(mockUsersWithOrg);

      const result = await service.findByOrganization(mockOrganization.id);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(UserResponseDto);
      expect(result[0].organizationId).toBe(mockOrganization.id);
      expect(result[1]).toBeInstanceOf(UserResponseDto);
      expect(result[1].organizationId).toBe(mockOrganization.id);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganization.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return empty array when no users exist in organization', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.findByOrganization('empty-org-id');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should exclude password from returned user data', async () => {
      mockPrisma.user.findMany.mockResolvedValue(mockUsersWithOrg);

      const result = await service.findByOrganization(mockOrganization.id);

      result.forEach((user) => {
        expect(user).not.toHaveProperty('password');
      });
    });

    it('should order users by creation date descending', async () => {
      mockPrisma.user.findMany.mockResolvedValue(mockUsersWithOrg);

      await service.findByOrganization(mockOrganization.id);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'desc',
          },
        }),
      );
    });

    it('should throw InternalServerErrorException on database error', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('Database error'));

      await expect(
        service.findByOrganization(mockOrganization.id),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('validateOrganizationAccess', () => {
    const superOwnerUser = {
      ...mockUser,
      role: 'SUPER_OWNER',
      organizationId: 'super-owner-org',
    };

    const ownerUser = {
      ...mockUser,
      role: 'OWNER',
    };

    const adminUser = {
      ...mockUser,
      role: 'ADMIN',
    };

    const agentUser = {
      ...mockUser,
      role: 'AGENT',
    };

    it('should return true for SUPER_OWNER accessing any organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        organizationId: superOwnerUser.organizationId,
        role: superOwnerUser.role,
      });

      const result = await service.validateOrganizationAccess(
        superOwnerUser.id,
        'any-other-org-id',
      );

      expect(result).toBe(true);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: superOwnerUser.id },
        select: { organizationId: true, role: true },
      });
    });

    it('should return true for user accessing their own organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        organizationId: ownerUser.organizationId,
        role: ownerUser.role,
      });

      const result = await service.validateOrganizationAccess(
        ownerUser.id,
        ownerUser.organizationId,
      );

      expect(result).toBe(true);
    });

    it('should return false for user accessing different organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        organizationId: adminUser.organizationId,
        role: adminUser.role,
      });

      const result = await service.validateOrganizationAccess(
        adminUser.id,
        'different-org-id',
      );

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateOrganizationAccess(
        'non-existent-id',
        mockOrganization.id,
      );

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await service.validateOrganizationAccess(
        mockUser.id,
        mockOrganization.id,
      );

      expect(result).toBe(false);
    });

    it('should handle OWNER role correctly', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        organizationId: ownerUser.organizationId,
        role: 'OWNER',
      });

      const resultSameOrg = await service.validateOrganizationAccess(
        ownerUser.id,
        ownerUser.organizationId,
      );
      expect(resultSameOrg).toBe(true);

      const resultDifferentOrg = await service.validateOrganizationAccess(
        ownerUser.id,
        'different-org',
      );
      expect(resultDifferentOrg).toBe(false);
    });

    it('should handle AGENT role correctly', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        organizationId: agentUser.organizationId,
        role: 'AGENT',
      });

      const resultSameOrg = await service.validateOrganizationAccess(
        agentUser.id,
        agentUser.organizationId,
      );
      expect(resultSameOrg).toBe(true);

      const resultDifferentOrg = await service.validateOrganizationAccess(
        agentUser.id,
        'different-org',
      );
      expect(resultDifferentOrg).toBe(false);
    });
  });

  describe('findByOrganizationWithRoleFilter', () => {
    const mockAgentUser = {
      id: 'agent-1',
      username: 'agent1',
      email: 'agent1@example.com',
      password: 'hashedpassword123',
      fullName: 'Agent One',
      organizationId: mockOrganization.id,
      role: 'AGENT',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      organization: { id: mockOrganization.id, name: mockOrganization.name },
    };

    const mockAdminUser = {
      id: 'admin-1',
      username: 'admin1',
      email: 'admin1@example.com',
      password: 'hashedpassword123',
      fullName: 'Admin One',
      organizationId: mockOrganization.id,
      role: 'ADMIN',
      createdAt: new Date('2023-01-02'),
      updatedAt: new Date('2023-01-02'),
      organization: { id: mockOrganization.id, name: mockOrganization.name },
    };

    const mockOwnerUser = {
      id: 'owner-1',
      username: 'owner1',
      email: 'owner1@example.com',
      password: 'hashedpassword123',
      fullName: 'Owner One',
      organizationId: mockOrganization.id,
      role: 'OWNER',
      createdAt: new Date('2023-01-03'),
      updatedAt: new Date('2023-01-03'),
      organization: { id: mockOrganization.id, name: mockOrganization.name },
    };

    describe('Role hierarchy filtering', () => {
      it('should allow SUPER_OWNER to see all roles', async () => {
        const allUsers = [mockAgentUser, mockAdminUser, mockOwnerUser];
        mockPrisma.user.count.mockResolvedValue(3);
        mockPrisma.user.findMany.mockResolvedValue(allUsers);

        const result = await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
        );

        expect(result.users).toHaveLength(3);
        expect(result.total).toBe(3);
        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              organizationId: mockOrganization.id,
            }),
          }),
        );
      });

      it('should allow OWNER to see ADMIN and AGENT roles only', async () => {
        const visibleUsers = [mockAgentUser, mockAdminUser];
        mockPrisma.user.count.mockResolvedValue(2);
        mockPrisma.user.findMany.mockResolvedValue(visibleUsers);

        const result = await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'OWNER',
        );

        expect(result.users).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              organizationId: mockOrganization.id,
              role: { in: ['ADMIN', 'AGENT'] },
            }),
          }),
        );
      });

      it('should allow ADMIN to see AGENT role only', async () => {
        const visibleUsers = [mockAgentUser];
        mockPrisma.user.count.mockResolvedValue(1);
        mockPrisma.user.findMany.mockResolvedValue(visibleUsers);

        const result = await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'ADMIN',
        );

        expect(result.users).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              organizationId: mockOrganization.id,
              role: 'AGENT',
            }),
          }),
        );
      });

      it('should override specific role filter when role hierarchy applies', async () => {
        // Even if we specify a role filter, hierarchy should take precedence
        const visibleUsers = [mockAgentUser];
        mockPrisma.user.count.mockResolvedValue(1);
        mockPrisma.user.findMany.mockResolvedValue(visibleUsers);

        await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'ADMIN',
          { role: 'OWNER' }, // This should be overridden by hierarchy
        );

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              role: 'AGENT', // Should be overridden to AGENT for ADMIN user
            }),
          }),
        );
      });
    });

    describe('Search functionality', () => {
      it('should search by username', async () => {
        const searchResults = [mockAgentUser];
        mockPrisma.user.count.mockResolvedValue(1);
        mockPrisma.user.findMany.mockResolvedValue(searchResults);

        const result = await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
          { search: 'agent1' },
        );

        expect(result.users).toHaveLength(1);
        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              organizationId: mockOrganization.id,
              OR: [
                { username: { contains: 'agent1', mode: 'insensitive' } },
                { email: { contains: 'agent1', mode: 'insensitive' } },
                { fullName: { contains: 'agent1', mode: 'insensitive' } },
              ],
            }),
          }),
        );
      });

      it('should search by email', async () => {
        const searchResults = [mockAdminUser];
        mockPrisma.user.count.mockResolvedValue(1);
        mockPrisma.user.findMany.mockResolvedValue(searchResults);

        await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
          { search: 'admin1@' },
        );

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [
                { username: { contains: 'admin1@', mode: 'insensitive' } },
                { email: { contains: 'admin1@', mode: 'insensitive' } },
                { fullName: { contains: 'admin1@', mode: 'insensitive' } },
              ],
            }),
          }),
        );
      });

      it('should search by full name', async () => {
        const searchResults = [mockOwnerUser];
        mockPrisma.user.count.mockResolvedValue(1);
        mockPrisma.user.findMany.mockResolvedValue(searchResults);

        await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
          { search: 'Owner One' },
        );

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [
                { username: { contains: 'Owner One', mode: 'insensitive' } },
                { email: { contains: 'Owner One', mode: 'insensitive' } },
                { fullName: { contains: 'Owner One', mode: 'insensitive' } },
              ],
            }),
          }),
        );
      });

      it('should handle case-insensitive search', async () => {
        mockPrisma.user.count.mockResolvedValue(0);
        mockPrisma.user.findMany.mockResolvedValue([]);

        await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
          { search: 'AGENT1' },
        );

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ mode: 'insensitive' }),
              ]),
            }),
          }),
        );
      });

      it('should return empty results for no matches', async () => {
        mockPrisma.user.count.mockResolvedValue(0);
        mockPrisma.user.findMany.mockResolvedValue([]);

        const result = await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
          { search: 'nonexistent' },
        );

        expect(result.users).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    describe('Pagination', () => {
      it('should use default pagination when not specified', async () => {
        mockPrisma.user.count.mockResolvedValue(100);
        mockPrisma.user.findMany.mockResolvedValue([mockAgentUser]);

        await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
        );

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 50, // Default limit
            skip: 0, // Default offset
          }),
        );
      });

      it('should apply custom limit and offset', async () => {
        mockPrisma.user.count.mockResolvedValue(100);
        mockPrisma.user.findMany.mockResolvedValue([mockAgentUser]);

        await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
          { limit: 20, offset: 40 },
        );

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 20,
            skip: 40,
          }),
        );
      });

      it('should handle pagination with role hierarchy', async () => {
        mockPrisma.user.count.mockResolvedValue(10);
        mockPrisma.user.findMany.mockResolvedValue([mockAgentUser]);

        await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'ADMIN',
          { limit: 5, offset: 2 },
        );

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              role: 'AGENT',
            }),
            take: 5,
            skip: 2,
          }),
        );
      });
    });

    describe('Sorting and ordering', () => {
      it('should order by role then fullName', async () => {
        mockPrisma.user.count.mockResolvedValue(3);
        mockPrisma.user.findMany.mockResolvedValue([
          mockAgentUser,
          mockAdminUser,
          mockOwnerUser,
        ]);

        await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
        );

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
          }),
        );
      });
    });

    describe('Role filtering', () => {
      it('should filter by specific role when SUPER_OWNER requests it', async () => {
        mockPrisma.user.count.mockResolvedValue(1);
        mockPrisma.user.findMany.mockResolvedValue([mockAdminUser]);

        await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
          { role: 'ADMIN' },
        );

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              organizationId: mockOrganization.id,
              role: 'ADMIN',
            }),
          }),
        );
      });
    });

    describe('Response formatting', () => {
      it('should return UserResponseDto instances without passwords', async () => {
        mockPrisma.user.count.mockResolvedValue(1);
        mockPrisma.user.findMany.mockResolvedValue([mockAgentUser]);

        const result = await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
        );

        expect(result.users[0]).toBeInstanceOf(UserResponseDto);
        expect(result.users[0]).not.toHaveProperty('password');
        expect(result.users[0].id).toBe(mockAgentUser.id);
        expect(result.users[0].role).toBe(mockAgentUser.role);
      });

      it('should return total count and users array', async () => {
        const totalCount = 25;
        mockPrisma.user.count.mockResolvedValue(totalCount);
        mockPrisma.user.findMany.mockResolvedValue([mockAgentUser]);

        const result = await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
        );

        expect(result).toHaveProperty('users');
        expect(result).toHaveProperty('total');
        expect(result.total).toBe(totalCount);
        expect(Array.isArray(result.users)).toBe(true);
      });
    });

    describe('Error handling', () => {
      it('should throw InternalServerErrorException on count database error', async () => {
        mockPrisma.user.count.mockRejectedValue(new Error('Count error'));

        await expect(
          service.findByOrganizationWithRoleFilter(
            mockOrganization.id,
            'SUPER_OWNER',
          ),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should throw InternalServerErrorException on findMany database error', async () => {
        mockPrisma.user.count.mockResolvedValue(1);
        mockPrisma.user.findMany.mockRejectedValue(new Error('FindMany error'));

        await expect(
          service.findByOrganizationWithRoleFilter(
            mockOrganization.id,
            'SUPER_OWNER',
          ),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should handle malformed search input gracefully', async () => {
        mockPrisma.user.count.mockResolvedValue(0);
        mockPrisma.user.findMany.mockResolvedValue([]);

        const result = await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
          { search: '' },
        );

        expect(result.users).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty organization gracefully', async () => {
        mockPrisma.user.count.mockResolvedValue(0);
        mockPrisma.user.findMany.mockResolvedValue([]);

        const result = await service.findByOrganizationWithRoleFilter(
          'empty-org-id',
          'SUPER_OWNER',
        );

        expect(result.users).toHaveLength(0);
        expect(result.total).toBe(0);
      });

      it('should handle zero limit gracefully', async () => {
        mockPrisma.user.count.mockResolvedValue(10);
        mockPrisma.user.findMany.mockResolvedValue([]);

        await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
          { limit: 0 },
        );

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 0,
          }),
        );
      });

      it('should handle high offset gracefully', async () => {
        mockPrisma.user.count.mockResolvedValue(5);
        mockPrisma.user.findMany.mockResolvedValue([]);

        const result = await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'SUPER_OWNER',
          { offset: 1000 },
        );

        expect(result.users).toHaveLength(0);
        expect(result.total).toBe(5);
      });

      it('should combine search with role hierarchy correctly', async () => {
        mockPrisma.user.count.mockResolvedValue(1);
        mockPrisma.user.findMany.mockResolvedValue([mockAgentUser]);

        await service.findByOrganizationWithRoleFilter(
          mockOrganization.id,
          'ADMIN',
          { search: 'agent' },
        );

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              organizationId: mockOrganization.id,
              role: 'AGENT', // Role hierarchy should still apply
              OR: expect.arrayContaining([
                { username: { contains: 'agent', mode: 'insensitive' } },
                { email: { contains: 'agent', mode: 'insensitive' } },
                { fullName: { contains: 'agent', mode: 'insensitive' } },
              ]),
            }),
          }),
        );
      });
    });
  });
});
