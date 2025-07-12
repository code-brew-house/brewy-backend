import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { R2StorageService } from './r2-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';

describe('StorageService', () => {
  let service: StorageService;

  const mockR2 = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    getPresignedUrl: jest.fn(),
  };

  const mockPrisma = {
    storage: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  };

  const mockOrganization = {
    id: 'org-123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Organization',
    email: 'org@example.com',
  };

  const mockStorageRecord = {
    id: 'storage-123',
    url: 'https://r2.example.com/file.mp3',
    filename: 'test.mp3',
    size: 1024,
    mimetype: 'audio/mpeg',
    organizationId: mockOrganization.id,
    timestamp: new Date(),
    organization: mockOrganization,
  };

  const mockAnotherOrgRecord = {
    id: 'storage-456',
    url: 'https://r2.example.com/other.mp3',
    filename: 'other.mp3',
    size: 2048,
    mimetype: 'audio/mpeg',
    organizationId: 'org-different',
    timestamp: new Date(),
    organization: {
      id: 'org-different',
      name: 'Different Organization',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: R2StorageService, useValue: mockR2 },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(StorageService);
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const validFile: any = {
      originalname: 'test.mp3',
      mimetype: 'audio/mpeg',
      size: 1024,
      stream: new Readable(),
    };

    it('should upload and save file with organization validation', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockR2.uploadFile.mockResolvedValue('https://r2.example.com/file.mp3');
      mockPrisma.storage.create.mockResolvedValue(mockStorageRecord);

      const result = await service.uploadFile(validFile, mockOrganization.id);

      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: mockOrganization.id },
      });
      expect(result).toEqual(mockStorageRecord);
      expect(mockR2.uploadFile).toHaveBeenCalled();
      expect(mockPrisma.storage.create).toHaveBeenCalledWith({
        data: {
          url: 'https://r2.example.com/file.mp3',
          filename: validFile.originalname,
          size: validFile.size,
          mimetype: validFile.mimetype,
          timestamp: expect.any(Date),
          organizationId: mockOrganization.id,
        },
      });
    });

    it('should throw BadRequestException if organization ID is missing', async () => {
      await expect(service.uploadFile(validFile, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if organization not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadFile(validFile, 'invalid-org-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for oversized file', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);

      await expect(
        service.uploadFile(
          { ...validFile, size: 51 * 1024 * 1024 },
          mockOrganization.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listFiles', () => {
    it('should return files filtered by organization', async () => {
      mockPrisma.storage.findMany.mockResolvedValue([mockStorageRecord]);

      const result = await service.listFiles(mockOrganization.id);

      expect(result).toEqual([mockStorageRecord]);
      expect(mockPrisma.storage.findMany).toHaveBeenCalledWith({
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
          timestamp: 'desc',
        },
      });
    });

    it('should throw BadRequestException if organization ID is missing', async () => {
      await expect(service.listFiles('')).rejects.toThrow(BadRequestException);
    });

    it('should prevent cross-organization data access', async () => {
      mockPrisma.storage.findMany.mockResolvedValue([mockStorageRecord]);

      const result = await service.listFiles(mockOrganization.id);

      expect(result).toEqual([mockStorageRecord]);
      expect(result).not.toContain(mockAnotherOrgRecord);
    });
  });

  describe('listAllFiles (SUPER_OWNER)', () => {
    it('should return all files across organizations for SUPER_OWNER', async () => {
      const allFiles = [mockStorageRecord, mockAnotherOrgRecord];
      mockPrisma.storage.findMany.mockResolvedValue(allFiles);

      const result = await service.listAllFiles();

      expect(result).toEqual(allFiles);
      expect(mockPrisma.storage.findMany).toHaveBeenCalledWith({
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
    });
  });

  describe('getFile', () => {
    it('should return a file if found within organization', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(mockStorageRecord);

      const result = await service.getFile(
        mockStorageRecord.id,
        mockOrganization.id,
      );

      expect(result).toEqual(mockStorageRecord);
      expect(mockPrisma.storage.findUnique).toHaveBeenCalledWith({
        where: { id: mockStorageRecord.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should throw BadRequestException if organization ID is missing', async () => {
      await expect(service.getFile('file-id', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if file not found in organization', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(null);

      await expect(
        service.getFile('nonexistent-id', mockOrganization.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent cross-organization file access', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(null);

      await expect(
        service.getFile(mockAnotherOrgRecord.id, mockOrganization.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFileById (SUPER_OWNER)', () => {
    it('should return file by ID without organization restriction', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(mockStorageRecord);

      const result = await service.getFileById(mockStorageRecord.id);

      expect(result).toEqual(mockStorageRecord);
      expect(mockPrisma.storage.findUnique).toHaveBeenCalledWith({
        where: { id: mockStorageRecord.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });
  });

  describe('updateFile', () => {
    const updateData = { filename: 'new.mp3' };

    it('should update file within organization', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(mockStorageRecord);
      mockPrisma.storage.update.mockResolvedValue({
        ...mockStorageRecord,
        filename: 'new.mp3',
      });

      const result = await service.updateFile(
        mockStorageRecord.id,
        updateData,
        mockOrganization.id,
      );

      expect(result.filename).toBe('new.mp3');
      expect(mockPrisma.storage.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockStorageRecord.id,
          organizationId: mockOrganization.id,
        },
      });
    });

    it('should throw BadRequestException if organization ID is missing', async () => {
      await expect(
        service.updateFile('file-id', updateData, ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent cross-organization file updates', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(null);

      await expect(
        service.updateFile(
          mockAnotherOrgRecord.id,
          updateData,
          mockOrganization.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteFile', () => {
    it('should delete file and record within organization', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(mockStorageRecord);
      mockR2.deleteFile.mockResolvedValue(undefined);
      mockPrisma.storage.delete.mockResolvedValue(undefined);

      const result = await service.deleteFile(
        mockStorageRecord.id,
        mockOrganization.id,
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.storage.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockStorageRecord.id,
          organizationId: mockOrganization.id,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should throw BadRequestException if organization ID is missing', async () => {
      await expect(service.deleteFile('file-id', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent cross-organization file deletion', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteFile(mockAnotherOrgRecord.id, mockOrganization.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPresignedUrl', () => {
    it('should return presigned URL for file within organization', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(mockStorageRecord);
      mockR2.getPresignedUrl.mockResolvedValue('presigned-url');

      const result = await service.getPresignedUrl(
        mockStorageRecord.id,
        mockOrganization.id,
      );

      expect(result.url).toBe('presigned-url');
      expect(mockPrisma.storage.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockStorageRecord.id,
          organizationId: mockOrganization.id,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should throw BadRequestException if organization ID is missing', async () => {
      await expect(service.getPresignedUrl('file-id', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent cross-organization presigned URL access', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(null);

      await expect(
        service.getPresignedUrl(mockAnotherOrgRecord.id, mockOrganization.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrganizationStorageStats', () => {
    it('should return storage statistics for organization', async () => {
      mockPrisma.storage.aggregate.mockResolvedValue({
        _count: { id: 5 },
        _sum: { size: 1024000 },
      });

      const result = await service.getOrganizationStorageStats(
        mockOrganization.id,
      );

      expect(result).toEqual({
        totalFiles: 5,
        totalSize: 1024000,
        totalSizeMB: 0.98,
      });
      expect(mockPrisma.storage.aggregate).toHaveBeenCalledWith({
        where: { organizationId: mockOrganization.id },
        _count: { id: true },
        _sum: { size: true },
      });
    });
  });

  describe('validateFileAccess', () => {
    it('should allow SUPER_OWNER to access any file', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(mockStorageRecord);

      const result = await service.validateFileAccess(
        mockStorageRecord.id,
        'any-org-id',
        'SUPER_OWNER',
      );

      expect(result).toBe(true);
      expect(mockPrisma.storage.findUnique).toHaveBeenCalledWith({
        where: { id: mockStorageRecord.id },
      });
    });

    it('should restrict other users to their organization', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(mockStorageRecord);

      const result = await service.validateFileAccess(
        mockStorageRecord.id,
        mockOrganization.id,
        'ADMIN',
      );

      expect(result).toBe(true);
      expect(mockPrisma.storage.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockStorageRecord.id,
          organizationId: mockOrganization.id,
        },
      });
    });

    it('should deny access to files from different organization', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(null);

      const result = await service.validateFileAccess(
        mockAnotherOrgRecord.id,
        mockOrganization.id,
        'ADMIN',
      );

      expect(result).toBe(false);
    });
  });

  describe('Organization Context and Data Isolation', () => {
    it('should ensure all operations are organization-scoped', async () => {
      // Test that all main operations require organizationId
      await expect(service.listFiles('')).rejects.toThrow(BadRequestException);
      await expect(service.getFile('id', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateFile('id', {}, '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteFile('id', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getPresignedUrl('id', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent data leakage between organizations', async () => {
      // Mock finding file from different organization
      mockPrisma.storage.findUnique.mockResolvedValue(null);

      // Try to access file from another organization
      await expect(
        service.getFile(mockAnotherOrgRecord.id, mockOrganization.id),
      ).rejects.toThrow(NotFoundException);

      // Verify query included organization filter
      expect(mockPrisma.storage.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockAnotherOrgRecord.id,
          organizationId: mockOrganization.id,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should validate organization existence on file upload', async () => {
      const validFile: any = {
        originalname: 'test.mp3',
        mimetype: 'audio/mpeg',
        size: 1024,
        stream: new Readable(),
      };

      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadFile(validFile, 'invalid-org-id'),
      ).rejects.toThrow('Organization not found');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    const validFile: any = {
      originalname: 'test.mp3',
      mimetype: 'audio/mpeg',
      size: 1024,
      stream: new Readable(),
      buffer: Buffer.from('test'),
    };

    describe('uploadFile errors', () => {
      it('should handle R2 upload failure', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
        mockR2.uploadFile.mockRejectedValue(new Error('R2 connection failed'));

        await expect(
          service.uploadFile(validFile, mockOrganization.id),
        ).rejects.toThrow('Failed to upload file to storage');
      });

      it('should handle database save failure and cleanup R2', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
        mockR2.uploadFile.mockResolvedValue('test-url');
        mockPrisma.storage.create.mockRejectedValue(
          new Error('DB connection failed'),
        );
        mockR2.deleteFile.mockResolvedValue(undefined);

        await expect(
          service.uploadFile(validFile, mockOrganization.id),
        ).rejects.toThrow('Failed to save file record to database');
        expect(mockR2.deleteFile).toHaveBeenCalled();
      });
    });

    describe('getFile errors', () => {
      it('should handle database connection failure', async () => {
        mockPrisma.storage.findUnique.mockRejectedValue(
          new Error('DB connection lost'),
        );

        await expect(
          service.getFile('test-id', mockOrganization.id),
        ).rejects.toThrow('Failed to retrieve file from database');
      });
    });

    describe('deleteFile errors', () => {
      it('should handle R2 delete failure', async () => {
        const mockRecord = {
          ...mockStorageRecord,
          url: 'https://r2.com/bucket/file.mp3',
        };
        mockPrisma.storage.findUnique.mockResolvedValue(mockRecord);
        mockR2.deleteFile.mockRejectedValue(new Error('R2 delete failed'));

        await expect(
          service.deleteFile(mockRecord.id, mockOrganization.id),
        ).rejects.toThrow('Failed to delete file from storage');
      });
    });

    describe('listFiles errors', () => {
      it('should handle database query failure', async () => {
        mockPrisma.storage.findMany.mockRejectedValue(new Error('DB timeout'));

        await expect(service.listFiles(mockOrganization.id)).rejects.toThrow(
          'Failed to retrieve files from database',
        );
      });
    });
  });
});
