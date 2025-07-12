import { Test, TestingModule } from '@nestjs/testing';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UpdateStorageDto } from './dto/update-storage.dto';
import { RequestUser } from '../../common/types/request.types';

describe('StorageController', () => {
  let controller: StorageController;
  let mockStorageService: any;

  const mockRequestUser: RequestUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    organizationId: 'org-123',
    role: 'ADMIN',
  };

  const mockSuperOwnerUser: RequestUser = {
    ...mockRequestUser,
    role: 'SUPER_OWNER',
  };

  const mockAgentUser: RequestUser = {
    ...mockRequestUser,
    role: 'AGENT',
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.mp3',
    encoding: '7bit',
    mimetype: 'audio/mpeg',
    buffer: Buffer.from('test file content'),
    size: 1024,
    stream: {} as any,
    destination: '',
    filename: '',
    path: '',
  };

  const mockStorageRecord = {
    id: 'file-123',
    filename: 'test.mp3',
    size: 1024,
    mimetype: 'audio/mpeg',
    url: 'https://r2.example.com/test.mp3',
    organizationId: 'org-123',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockStorageStats = {
    totalFiles: 10,
    totalSize: 10240,
    organizationId: 'org-123',
  };

  beforeEach(async () => {
    mockStorageService = {
      uploadFile: jest.fn(),
      listFiles: jest.fn(),
      getFile: jest.fn(),
      updateFile: jest.fn(),
      deleteFile: jest.fn(),
      getPresignedUrl: jest.fn(),
      validateFileAccess: jest.fn(),
      getOrganizationStorageStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    controller = module.get<StorageController>(StorageController);
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a valid MP3 file successfully', async () => {
      mockStorageService.uploadFile.mockResolvedValue(mockStorageRecord);

      const result = await controller.uploadFile(mockFile, 'org-123');

      expect(result).toEqual(mockStorageRecord);
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        mockFile,
        'org-123',
      );
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(
        controller.uploadFile(undefined as any, 'org-123'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.uploadFile(undefined as any, 'org-123'),
      ).rejects.toThrow('File is required');
    });

    it('should handle file size limit errors', async () => {
      mockStorageService.uploadFile.mockRejectedValue(
        new Error('File size exceeds limit'),
      );

      await expect(controller.uploadFile(mockFile, 'org-123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.uploadFile(mockFile, 'org-123')).rejects.toThrow(
        'File size exceeds 50MB limit',
      );
    });

    it('should handle invalid file type errors', async () => {
      mockStorageService.uploadFile.mockRejectedValue(
        new Error('Only MP3 files are allowed'),
      );

      await expect(controller.uploadFile(mockFile, 'org-123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.uploadFile(mockFile, 'org-123')).rejects.toThrow(
        'Only MP3 files are allowed',
      );
    });

    it('should propagate other errors as-is', async () => {
      const otherError = new InternalServerErrorException('Storage error');
      mockStorageService.uploadFile.mockRejectedValue(otherError);

      await expect(controller.uploadFile(mockFile, 'org-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle file with different valid MP3 mimetypes', async () => {
      const mp3File = {
        ...mockFile,
        mimetype: 'audio/mp3',
      };
      mockStorageService.uploadFile.mockResolvedValue(mockStorageRecord);

      const result = await controller.uploadFile(mp3File, 'org-123');

      expect(result).toEqual(mockStorageRecord);
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        mp3File,
        'org-123',
      );
    });
  });

  describe('listFiles', () => {
    const mockFilesList = [mockStorageRecord];

    it('should list files for regular user with organization filter', async () => {
      mockStorageService.listFiles.mockResolvedValue(mockFilesList);

      const result = await controller.listFiles(mockRequestUser, 'org-123');

      expect(result).toEqual(mockFilesList);
      expect(mockStorageService.listFiles).toHaveBeenCalledWith('org-123');
    });

    it('should list all files for SUPER_OWNER without organization filter', async () => {
      mockStorageService.listFiles.mockResolvedValue(mockFilesList);

      const result = await controller.listFiles(mockSuperOwnerUser, 'org-123');

      expect(result).toEqual(mockFilesList);
      expect(mockStorageService.listFiles).toHaveBeenCalledWith(undefined);
    });

    it('should handle service errors', async () => {
      mockStorageService.listFiles.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.listFiles(mockRequestUser, 'org-123'),
      ).rejects.toThrow('Database error');
    });

    it('should work for different user roles', async () => {
      mockStorageService.listFiles.mockResolvedValue(mockFilesList);

      // Test AGENT role
      await controller.listFiles(mockAgentUser, 'org-123');
      expect(mockStorageService.listFiles).toHaveBeenCalledWith('org-123');

      // Test OWNER role
      const ownerUser = { ...mockRequestUser, role: 'OWNER' as const };
      await controller.listFiles(ownerUser, 'org-123');
      expect(mockStorageService.listFiles).toHaveBeenCalledWith('org-123');
    });
  });

  describe('getFile', () => {
    const fileId = 'file-123';

    it('should get file for user with access', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.getFile.mockResolvedValue(mockStorageRecord);

      const result = await controller.getFile(
        fileId,
        mockRequestUser,
        'org-123',
      );

      expect(result).toEqual(mockStorageRecord);
      expect(mockStorageService.validateFileAccess).toHaveBeenCalledWith(
        fileId,
        'org-123',
        'ADMIN',
      );
      expect(mockStorageService.getFile).toHaveBeenCalledWith(
        fileId,
        'org-123',
      );
    });

    it('should throw NotFoundException when user has no access', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(false);

      await expect(
        controller.getFile(fileId, mockRequestUser, 'org-123'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.getFile(fileId, mockRequestUser, 'org-123'),
      ).rejects.toThrow('File not found');

      expect(mockStorageService.getFile).not.toHaveBeenCalled();
    });

    it('should handle SUPER_OWNER access without organization filter', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.getFile.mockResolvedValue(mockStorageRecord);

      const result = await controller.getFile(
        fileId,
        mockSuperOwnerUser,
        'org-123',
      );

      expect(result).toEqual(mockStorageRecord);
      expect(mockStorageService.getFile).toHaveBeenCalledWith(
        fileId,
        undefined,
      );
    });

    it('should handle invalid UUID format', async () => {
      // This would be handled by ParseUUIDPipe in the actual request
      // but we test the controller logic after validation
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.getFile.mockResolvedValue(mockStorageRecord);

      await controller.getFile('valid-uuid', mockRequestUser, 'org-123');
      expect(mockStorageService.validateFileAccess).toHaveBeenCalled();
    });

    it('should handle service errors during file retrieval', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.getFile.mockRejectedValue(new Error('Storage error'));

      await expect(
        controller.getFile(fileId, mockRequestUser, 'org-123'),
      ).rejects.toThrow('Storage error');
    });
  });

  describe('updateFile', () => {
    const fileId = 'file-123';
    const updateDto: UpdateStorageDto = {
      filename: 'updated-file.mp3',
      mimetype: 'audio/mpeg',
    };

    it('should update file for user with access', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.updateFile.mockResolvedValue({
        ...mockStorageRecord,
        ...updateDto,
      });

      const result = await controller.updateFile(
        fileId,
        updateDto,
        mockRequestUser,
        'org-123',
      );

      expect(result).toEqual({ ...mockStorageRecord, ...updateDto });
      expect(mockStorageService.validateFileAccess).toHaveBeenCalledWith(
        fileId,
        'org-123',
        'ADMIN',
      );
      expect(mockStorageService.updateFile).toHaveBeenCalledWith(
        fileId,
        updateDto,
        'org-123',
      );
    });

    it('should throw NotFoundException when user has no access', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(false);

      await expect(
        controller.updateFile(fileId, updateDto, mockRequestUser, 'org-123'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.updateFile(fileId, updateDto, mockRequestUser, 'org-123'),
      ).rejects.toThrow('File not found');

      expect(mockStorageService.updateFile).not.toHaveBeenCalled();
    });

    it('should handle SUPER_OWNER updates without organization filter', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.updateFile.mockResolvedValue({
        ...mockStorageRecord,
        ...updateDto,
      });

      const result = await controller.updateFile(
        fileId,
        updateDto,
        mockSuperOwnerUser,
        'org-123',
      );

      expect(result).toEqual({ ...mockStorageRecord, ...updateDto });
      expect(mockStorageService.updateFile).toHaveBeenCalledWith(
        fileId,
        updateDto,
        undefined,
      );
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { filename: 'new-name.mp3' };
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.updateFile.mockResolvedValue({
        ...mockStorageRecord,
        ...partialUpdate,
      });

      const result = await controller.updateFile(
        fileId,
        partialUpdate,
        mockRequestUser,
        'org-123',
      );

      expect(result).toEqual({ ...mockStorageRecord, ...partialUpdate });
      expect(mockStorageService.updateFile).toHaveBeenCalledWith(
        fileId,
        partialUpdate,
        'org-123',
      );
    });

    it('should handle service errors during update', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.updateFile.mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(
        controller.updateFile(fileId, updateDto, mockRequestUser, 'org-123'),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('deleteFile', () => {
    const fileId = 'file-123';

    it('should delete file for user with access', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.deleteFile.mockResolvedValue({ success: true });

      const result = await controller.deleteFile(
        fileId,
        mockRequestUser,
        'org-123',
      );

      expect(result).toEqual({ success: true });
      expect(mockStorageService.validateFileAccess).toHaveBeenCalledWith(
        fileId,
        'org-123',
        'ADMIN',
      );
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        fileId,
        'org-123',
      );
    });

    it('should throw NotFoundException when user has no access', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(false);

      await expect(
        controller.deleteFile(fileId, mockRequestUser, 'org-123'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.deleteFile(fileId, mockRequestUser, 'org-123'),
      ).rejects.toThrow('File not found');

      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle SUPER_OWNER deletions without organization filter', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.deleteFile.mockResolvedValue({ success: true });

      const result = await controller.deleteFile(
        fileId,
        mockSuperOwnerUser,
        'org-123',
      );

      expect(result).toEqual({ success: true });
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        fileId,
        undefined,
      );
    });

    it('should handle service errors during deletion', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.deleteFile.mockRejectedValue(
        new Error('Deletion failed'),
      );

      await expect(
        controller.deleteFile(fileId, mockRequestUser, 'org-123'),
      ).rejects.toThrow('Deletion failed');
    });

    it('should work for OWNER role', async () => {
      const ownerUser = { ...mockRequestUser, role: 'OWNER' as const };
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.deleteFile.mockResolvedValue({ success: true });

      await controller.deleteFile(fileId, ownerUser, 'org-123');

      expect(mockStorageService.validateFileAccess).toHaveBeenCalledWith(
        fileId,
        'org-123',
        'OWNER',
      );
    });
  });

  describe('getPresignedUrl', () => {
    const fileId = 'file-123';
    const mockPresignedUrl = {
      url: 'https://r2.example.com/presigned-url',
      expiresIn: 3600,
    };

    it('should get presigned URL for user with access', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.getPresignedUrl.mockResolvedValue(mockPresignedUrl);

      const result = await controller.getPresignedUrl(
        fileId,
        mockRequestUser,
        'org-123',
      );

      expect(result).toEqual(mockPresignedUrl);
      expect(mockStorageService.validateFileAccess).toHaveBeenCalledWith(
        fileId,
        'org-123',
        'ADMIN',
      );
      expect(mockStorageService.getPresignedUrl).toHaveBeenCalledWith(
        fileId,
        'org-123',
      );
    });

    it('should throw NotFoundException when user has no access', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(false);

      await expect(
        controller.getPresignedUrl(fileId, mockRequestUser, 'org-123'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.getPresignedUrl(fileId, mockRequestUser, 'org-123'),
      ).rejects.toThrow('File not found');

      expect(mockStorageService.getPresignedUrl).not.toHaveBeenCalled();
    });

    it('should handle SUPER_OWNER access without organization filter', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.getPresignedUrl.mockResolvedValue(mockPresignedUrl);

      const result = await controller.getPresignedUrl(
        fileId,
        mockSuperOwnerUser,
        'org-123',
      );

      expect(result).toEqual(mockPresignedUrl);
      expect(mockStorageService.getPresignedUrl).toHaveBeenCalledWith(
        fileId,
        undefined,
      );
    });

    it('should work for AGENT role', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.getPresignedUrl.mockResolvedValue(mockPresignedUrl);

      await controller.getPresignedUrl(fileId, mockAgentUser, 'org-123');

      expect(mockStorageService.validateFileAccess).toHaveBeenCalledWith(
        fileId,
        'org-123',
        'AGENT',
      );
    });

    it('should handle service errors during presigned URL generation', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.getPresignedUrl.mockRejectedValue(
        new Error('URL generation failed'),
      );

      await expect(
        controller.getPresignedUrl(fileId, mockRequestUser, 'org-123'),
      ).rejects.toThrow('URL generation failed');
    });
  });

  describe('getStorageStats', () => {
    it('should get storage statistics for organization', async () => {
      mockStorageService.getOrganizationStorageStats.mockResolvedValue(
        mockStorageStats,
      );

      const result = await controller.getStorageStats('org-123');

      expect(result).toEqual(mockStorageStats);
      expect(
        mockStorageService.getOrganizationStorageStats,
      ).toHaveBeenCalledWith('org-123');
    });

    it('should handle service errors during stats retrieval', async () => {
      mockStorageService.getOrganizationStorageStats.mockRejectedValue(
        new Error('Stats retrieval failed'),
      );

      await expect(controller.getStorageStats('org-123')).rejects.toThrow(
        'Stats retrieval failed',
      );
    });

    it('should return empty stats for organization with no files', async () => {
      const emptyStats = {
        totalFiles: 0,
        totalSize: 0,
        organizationId: 'org-123',
      };
      mockStorageService.getOrganizationStorageStats.mockResolvedValue(
        emptyStats,
      );

      const result = await controller.getStorageStats('org-123');

      expect(result).toEqual(emptyStats);
    });
  });

  describe('Error Handling', () => {
    it('should handle access validation errors properly', async () => {
      const fileId = 'file-123';
      mockStorageService.validateFileAccess.mockRejectedValue(
        new Error('Validation error'),
      );

      await expect(
        controller.getFile(fileId, mockRequestUser, 'org-123'),
      ).rejects.toThrow('Validation error');
    });

    it('should preserve specific error types from service layer', async () => {
      mockStorageService.uploadFile.mockRejectedValue(
        new BadRequestException('Invalid file format'),
      );

      await expect(controller.uploadFile(mockFile, 'org-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle concurrent access scenarios', async () => {
      const fileId = 'file-123';
      // Simulate race condition where file access changes between validation and operation
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.deleteFile.mockRejectedValue(
        new NotFoundException('File was deleted by another user'),
      );

      await expect(
        controller.deleteFile(fileId, mockRequestUser, 'org-123'),
      ).rejects.toThrow('File was deleted by another user');
    });
  });

  describe('Role-Based Access Control', () => {
    const fileId = 'file-123';

    it('should validate access for different user roles', async () => {
      const roles: Array<RequestUser['role']> = [
        'SUPER_OWNER',
        'OWNER',
        'ADMIN',
        'AGENT',
      ];

      for (const role of roles) {
        const user = { ...mockRequestUser, role };
        mockStorageService.validateFileAccess.mockResolvedValue(true);
        mockStorageService.getFile.mockResolvedValue(mockStorageRecord);

        await controller.getFile(fileId, user, 'org-123');

        expect(mockStorageService.validateFileAccess).toHaveBeenCalledWith(
          fileId,
          'org-123',
          role,
        );
      }
    });

    it('should handle SUPER_OWNER special privileges consistently', async () => {
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.getFile.mockResolvedValue(mockStorageRecord);
      mockStorageService.updateFile.mockResolvedValue(mockStorageRecord);
      mockStorageService.deleteFile.mockResolvedValue({ success: true });

      // Test that SUPER_OWNER uses undefined organization filter
      await controller.getFile(fileId, mockSuperOwnerUser, 'org-123');
      expect(mockStorageService.getFile).toHaveBeenCalledWith(
        fileId,
        undefined,
      );

      await controller.updateFile(
        fileId,
        { filename: 'new.mp3' },
        mockSuperOwnerUser,
        'org-123',
      );
      expect(mockStorageService.updateFile).toHaveBeenCalledWith(
        fileId,
        { filename: 'new.mp3' },
        undefined,
      );

      await controller.deleteFile(fileId, mockSuperOwnerUser, 'org-123');
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        fileId,
        undefined,
      );
    });
  });

  describe('Input Validation', () => {
    it('should handle empty update DTO', async () => {
      const fileId = 'file-123';
      const emptyUpdate = {};
      mockStorageService.validateFileAccess.mockResolvedValue(true);
      mockStorageService.updateFile.mockResolvedValue(mockStorageRecord);

      await controller.updateFile(
        fileId,
        emptyUpdate,
        mockRequestUser,
        'org-123',
      );

      expect(mockStorageService.updateFile).toHaveBeenCalledWith(
        fileId,
        emptyUpdate,
        'org-123',
      );
    });

    it('should handle null file in upload', async () => {
      await expect(
        controller.uploadFile(null as any, 'org-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle various file properties', async () => {
      const fileWithDifferentProps = {
        ...mockFile,
        originalname: 'test-file-with-spaces and symbols!.mp3',
        size: 5 * 1024 * 1024, // 5MB
      };

      mockStorageService.uploadFile.mockResolvedValue(mockStorageRecord);

      await controller.uploadFile(fileWithDifferentProps, 'org-123');

      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        fileWithDifferentProps,
        'org-123',
      );
    });
  });
});
