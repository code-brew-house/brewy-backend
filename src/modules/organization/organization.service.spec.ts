import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { IOrganization } from './types/organization.types';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let mockPrisma: any;

  const mockOrganization: IOrganization = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Organization',
    email: 'test@organization.com',
    contactNumber: '+1234567890',
    totalMemberCount: 5,
    maxUsers: 10,
    maxConcurrentJobs: 5,
    archivedAt: null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockArchivedOrganization: IOrganization = {
    ...mockOrganization,
    id: '456e7890-e89b-12d3-a456-426614174001',
    archivedAt: new Date('2023-06-01'),
  };

  const mockCreateOrganizationDto: CreateOrganizationDto = {
    name: 'Test Organization',
    email: 'test@organization.com',
    contactNumber: '+1234567890',
  };

  const mockUpdateOrganizationDto: UpdateOrganizationDto = {
    name: 'Updated Organization',
    email: 'updated@organization.com',
  };

  beforeEach(async () => {
    mockPrisma = {
      organization: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new organization successfully', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null); // No existing email
      mockPrisma.organization.create.mockResolvedValue(mockOrganization);

      const result = await service.create(mockCreateOrganizationDto);

      expect(result).toEqual(mockOrganization);
      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          email: mockCreateOrganizationDto.email,
          archivedAt: null,
        },
      });
      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: mockCreateOrganizationDto.name,
          email: mockCreateOrganizationDto.email,
          contactNumber: mockCreateOrganizationDto.contactNumber,
          totalMemberCount: 0,
        },
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(mockOrganization);

      await expect(service.create(mockCreateOrganizationDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    });

    it('should create organization when email exists only in archived organization', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null); // No active org with email
      mockPrisma.organization.create.mockResolvedValue(mockOrganization);

      const result = await service.create(mockCreateOrganizationDto);

      expect(result).toEqual(mockOrganization);
      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          email: mockCreateOrganizationDto.email,
          archivedAt: null,
        },
      });
    });

    it('should throw InternalServerErrorException when database error occurs', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.organization.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.create(mockCreateOrganizationDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all organizations successfully', async () => {
      const mockOrganizations = [
        mockOrganization,
        { ...mockOrganization, id: '456' },
      ];
      mockPrisma.organization.findMany.mockResolvedValue(mockOrganizations);

      const result = await service.findAll();

      expect(result).toEqual(mockOrganizations);
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        where: { archivedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no organizations exist', async () => {
      mockPrisma.organization.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should throw InternalServerErrorException when database error occurs', async () => {
      mockPrisma.organization.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findAll()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findOne', () => {
    it('should return organization by ID successfully', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(mockOrganization);

      const result = await service.findOne(mockOrganization.id);

      expect(result).toEqual(mockOrganization);
      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockOrganization.id,
          archivedAt: null,
        },
      });
    });

    it('should throw NotFoundException when organization not found', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when organization is archived', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null); // No active org found

      await expect(
        service.findOne(mockArchivedOrganization.id),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockArchivedOrganization.id,
          archivedAt: null,
        },
      });
    });

    it('should throw InternalServerErrorException when database error occurs', async () => {
      mockPrisma.organization.findFirst.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findOne(mockOrganization.id)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('update', () => {
    it('should update organization successfully', async () => {
      const updatedOrganization = {
        ...mockOrganization,
        ...mockUpdateOrganizationDto,
      };
      mockPrisma.organization.findFirst
        .mockResolvedValueOnce(mockOrganization) // First call for existence check
        .mockResolvedValueOnce(null); // Second call for email conflict check (no conflict)
      mockPrisma.organization.update.mockResolvedValue(updatedOrganization);

      const result = await service.update(
        mockOrganization.id,
        mockUpdateOrganizationDto,
      );

      expect(result).toEqual(updatedOrganization);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrganization.id },
        data: mockUpdateOrganizationDto,
      });
    });

    it('should throw NotFoundException when organization not found', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', mockUpdateOrganizationDto),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists for different organization', async () => {
      const existingOrganization = {
        ...mockOrganization,
        email: 'existing@org.com',
      };
      const anotherOrganization = {
        ...mockOrganization,
        id: '456',
        email: 'updated@organization.com',
      };

      mockPrisma.organization.findFirst
        .mockResolvedValueOnce(existingOrganization) // First call for existence check
        .mockResolvedValueOnce(anotherOrganization); // Second call for email conflict check

      await expect(
        service.update(mockOrganization.id, mockUpdateOrganizationDto),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('should not throw ConflictException when email is the same as current', async () => {
      const updateDto = {
        ...mockUpdateOrganizationDto,
        email: mockOrganization.email,
      };
      const updatedOrganization = { ...mockOrganization, ...updateDto };

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrganization);
      mockPrisma.organization.update.mockResolvedValue(updatedOrganization);

      const result = await service.update(mockOrganization.id, updateDto);

      expect(result).toEqual(updatedOrganization);
      expect(mockPrisma.organization.update).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when database error occurs', async () => {
      mockPrisma.organization.findFirst
        .mockResolvedValueOnce(mockOrganization) // First call for existence check
        .mockResolvedValueOnce(null); // Second call for email conflict check (no conflict)
      mockPrisma.organization.update.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.update(mockOrganization.id, mockUpdateOrganizationDto),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('remove', () => {
    it('should archive organization successfully (soft delete)', async () => {
      const archivedOrganization = {
        ...mockOrganization,
        archivedAt: new Date(),
      };
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.organization.update.mockResolvedValue(archivedOrganization);

      const result = await service.remove(mockOrganization.id);

      expect(result).toEqual(archivedOrganization);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrganization.id },
        data: { archivedAt: expect.any(Date) },
      });
      expect(mockPrisma.organization.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when organization not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when organization is already archived', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(
        mockArchivedOrganization,
      );

      await expect(service.remove(mockArchivedOrganization.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when database error occurs', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.organization.update.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.remove(mockOrganization.id)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('incrementMemberCount', () => {
    it('should increment member count successfully', async () => {
      const updatedOrganization = { ...mockOrganization, totalMemberCount: 6 };
      mockPrisma.organization.findFirst.mockResolvedValue(mockOrganization);
      mockPrisma.organization.update.mockResolvedValue(updatedOrganization);

      const result = await service.incrementMemberCount(mockOrganization.id);

      expect(result).toEqual(updatedOrganization);
      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockOrganization.id,
          archivedAt: null,
        },
      });
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrganization.id },
        data: { totalMemberCount: { increment: 1 } },
      });
    });

    it('should throw NotFoundException when organization not found', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.incrementMemberCount('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when database error occurs', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(mockOrganization);
      mockPrisma.organization.update.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.incrementMemberCount(mockOrganization.id),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('decrementMemberCount', () => {
    it('should decrement member count successfully', async () => {
      const updatedOrganization = { ...mockOrganization, totalMemberCount: 4 };
      mockPrisma.organization.findFirst.mockResolvedValue(mockOrganization);
      mockPrisma.organization.update.mockResolvedValue(updatedOrganization);

      const result = await service.decrementMemberCount(mockOrganization.id);

      expect(result).toEqual(updatedOrganization);
      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockOrganization.id,
          archivedAt: null,
        },
      });
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrganization.id },
        data: { totalMemberCount: { decrement: 1 } },
      });
    });

    it('should throw NotFoundException when organization not found', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.decrementMemberCount('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when member count is already zero', async () => {
      const zeroCountOrganization = {
        ...mockOrganization,
        totalMemberCount: 0,
      };
      mockPrisma.organization.findFirst.mockResolvedValue(
        zeroCountOrganization,
      );

      await expect(
        service.decrementMemberCount(mockOrganization.id),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when member count is negative', async () => {
      const negativeCountOrganization = {
        ...mockOrganization,
        totalMemberCount: -1,
      };
      mockPrisma.organization.findFirst.mockResolvedValue(
        negativeCountOrganization,
      );

      await expect(
        service.decrementMemberCount(mockOrganization.id),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when database error occurs', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(mockOrganization);
      mockPrisma.organization.update.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.decrementMemberCount(mockOrganization.id),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findAllForAdmin', () => {
    it('should exclude archived organizations by default', async () => {
      const activeOrganizations = [mockOrganization];
      mockPrisma.organization.count.mockResolvedValue(1);
      mockPrisma.organization.findMany.mockResolvedValue(activeOrganizations);

      const filters = { limit: 10, offset: 0 };
      const result = await service.findAllForAdmin(filters);

      expect(result.organizations).toEqual(activeOrganizations);
      expect(result.total).toBe(1);
      expect(mockPrisma.organization.count).toHaveBeenCalledWith({
        where: { archivedAt: null },
      });
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        where: { archivedAt: null },
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
        take: 10,
        skip: 0,
      });
    });

    it('should apply filters while excluding archived organizations', async () => {
      const filteredOrganizations = [mockOrganization];
      mockPrisma.organization.count.mockResolvedValue(1);
      mockPrisma.organization.findMany.mockResolvedValue(filteredOrganizations);

      const filters = {
        name: 'Test',
        email: 'test@',
        limit: 5,
        offset: 0,
      };
      const result = await service.findAllForAdmin(filters);

      expect(result.organizations).toEqual(filteredOrganizations);
      expect(mockPrisma.organization.count).toHaveBeenCalledWith({
        where: {
          archivedAt: null,
          name: { contains: 'Test', mode: 'insensitive' },
          email: { contains: 'test@', mode: 'insensitive' },
        },
      });
    });
  });

  describe('Archival Functionality', () => {
    it('should exclude archived organizations from findAll', async () => {
      const activeOrganizations = [mockOrganization];
      mockPrisma.organization.findMany.mockResolvedValue(activeOrganizations);

      const result = await service.findAll();

      expect(result).toEqual(activeOrganizations);
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        where: { archivedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should not find archived organization by ID', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(mockArchivedOrganization.id),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockArchivedOrganization.id,
          archivedAt: null,
        },
      });
    });

    it('should not allow updating archived organization', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockArchivedOrganization.id, mockUpdateOrganizationDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not allow incrementing member count for archived organization', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.incrementMemberCount(mockArchivedOrganization.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not allow decrementing member count for archived organization', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.decrementMemberCount(mockArchivedOrganization.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow creating new organization with email from archived organization', async () => {
      const newOrgDto = {
        ...mockCreateOrganizationDto,
        email: mockArchivedOrganization.email,
      };
      const newOrganization = { ...mockOrganization, email: newOrgDto.email };

      mockPrisma.organization.findFirst.mockResolvedValue(null); // No active org with email
      mockPrisma.organization.create.mockResolvedValue(newOrganization);

      const result = await service.create(newOrgDto);

      expect(result).toEqual(newOrganization);
      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          email: newOrgDto.email,
          archivedAt: null,
        },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string inputs gracefully', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(service.findOne('')).rejects.toThrow(NotFoundException);
    });

    it('should handle null values in update DTO', async () => {
      const emptyUpdateDto = {};
      const updatedOrganization = { ...mockOrganization };

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrganization);
      mockPrisma.organization.update.mockResolvedValue(updatedOrganization);

      const result = await service.update(mockOrganization.id, emptyUpdateDto);

      expect(result).toEqual(updatedOrganization);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrganization.id },
        data: emptyUpdateDto,
      });
    });
  });
});
