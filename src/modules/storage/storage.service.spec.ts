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
      update: jest.fn(),
      delete: jest.fn(),
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

    it('should upload and save any file type', async () => {
      mockR2.uploadFile.mockResolvedValue('url');
      mockPrisma.storage.create.mockResolvedValue({ id: '1', url: 'url' });
      const result = await service.uploadFile(validFile);
      expect(result.url).toBe('url');
      expect(mockR2.uploadFile).toHaveBeenCalled();
      expect(mockPrisma.storage.create).toHaveBeenCalled();
    });

    it('should throw for oversized file', async () => {
      await expect(
        service.uploadFile({ ...validFile, size: 51 * 1024 * 1024 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listFiles', () => {
    it('should return all files', async () => {
      mockPrisma.storage.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const result = await service.listFiles();
      expect(result.length).toBe(2);
    });
  });

  describe('getFile', () => {
    it('should return a file if found', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue({ id: '1' });
      const result = await service.getFile('1');
      expect(result.id).toBe('1');
    });
    it('should throw NotFoundException if not found', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(null);
      await expect(service.getFile('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateFile', () => {
    it('should update and return the file', async () => {
      mockPrisma.storage.update.mockResolvedValue({
        id: '1',
        filename: 'new.mp3',
      });
      const result = await service.updateFile('1', { filename: 'new.mp3' });
      expect(result.filename).toBe('new.mp3');
    });
    it('should throw NotFoundException if not found', async () => {
      const error: any = new Error('not found');
      error.code = 'P2025';
      mockPrisma.storage.update.mockRejectedValue(error);
      await expect(
        service.updateFile('x', { filename: 'fail' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteFile', () => {
    it('should delete file and record', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue({
        id: '1',
        url: 'http://r2/bucket/key',
      });
      mockR2.deleteFile.mockResolvedValue(undefined);
      mockPrisma.storage.delete.mockResolvedValue(undefined);
      const result = await service.deleteFile('1');
      expect(result.success).toBe(true);
    });
    it('should throw NotFoundException if not found', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(null);
      await expect(service.deleteFile('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPresignedUrl', () => {
    it('should return a presigned URL', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue({
        id: '1',
        url: 'http://r2/bucket/key',
      });
      mockR2.getPresignedUrl.mockResolvedValue('presigned-url');
      const result = await service.getPresignedUrl('1');
      expect(result.url).toBe('presigned-url');
    });
    it('should throw NotFoundException if not found', async () => {
      mockPrisma.storage.findUnique.mockResolvedValue(null);
      await expect(service.getPresignedUrl('x')).rejects.toThrow(
        NotFoundException,
      );
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
        mockR2.uploadFile.mockRejectedValue(new Error('R2 connection failed'));
        await expect(service.uploadFile(validFile)).rejects.toThrow(
          'Failed to upload file to storage',
        );
      });

      it('should handle database save failure and cleanup R2', async () => {
        mockR2.uploadFile.mockResolvedValue('test-url');
        mockPrisma.storage.create.mockRejectedValue(
          new Error('DB connection failed'),
        );
        mockR2.deleteFile.mockResolvedValue(undefined);
        await expect(service.uploadFile(validFile)).rejects.toThrow(
          'Failed to save file record to database',
        );
        expect(mockR2.deleteFile).toHaveBeenCalled();
      });

      it('should handle cleanup failure gracefully', async () => {
        mockR2.uploadFile.mockResolvedValue('test-url');
        mockPrisma.storage.create.mockRejectedValue(new Error('DB failed'));
        mockR2.deleteFile.mockRejectedValue(new Error('Cleanup failed'));
        await expect(service.uploadFile(validFile)).rejects.toThrow(
          'Failed to save file record to database',
        );
        expect(mockR2.deleteFile).toHaveBeenCalled();
      });

      it('should handle invalid file buffer', async () => {
        const file = { ...validFile, buffer: null };
        await expect(service.uploadFile(file)).rejects.toThrow();
      });
    });

    describe('getFile errors', () => {
      it('should handle database connection failure', async () => {
        mockPrisma.storage.findUnique.mockRejectedValue(
          new Error('DB connection lost'),
        );
        await expect(service.getFile('test-id')).rejects.toThrow(
          'Failed to retrieve file from database',
        );
      });

      it('should handle malformed ID gracefully', async () => {
        mockPrisma.storage.findUnique.mockResolvedValue(null);
        await expect(service.getFile('')).rejects.toThrow(
          'File with ID  not found',
        );
      });
    });

    describe('deleteFile errors', () => {
      it('should handle R2 delete failure', async () => {
        const mockRecord = { id: '1', url: 'https://r2.com/bucket/file.mp3' };
        mockPrisma.storage.findUnique.mockResolvedValue(mockRecord);
        mockR2.deleteFile.mockRejectedValue(new Error('R2 delete failed'));
        await expect(service.deleteFile('1')).rejects.toThrow(
          'Failed to delete file from storage',
        );
      });

      it('should handle DB delete failure after R2 success', async () => {
        const mockRecord = { id: '1', url: 'https://r2.com/bucket/file.mp3' };
        mockPrisma.storage.findUnique.mockResolvedValue(mockRecord);
        mockR2.deleteFile.mockResolvedValue(undefined);
        mockPrisma.storage.delete.mockRejectedValue(
          new Error('DB delete failed'),
        );
        await expect(service.deleteFile('1')).rejects.toThrow(
          'Failed to delete file record from database',
        );
      });

      it('should handle malformed URL gracefully', async () => {
        const mockRecord = { id: '1', url: 'invalid-url' };
        mockPrisma.storage.findUnique.mockResolvedValue(mockRecord);
        mockR2.deleteFile.mockRejectedValue(new Error('Invalid key format'));
        await expect(service.deleteFile('1')).rejects.toThrow(
          'Failed to delete file from storage',
        );
      });
    });

    describe('updateFile errors', () => {
      it('should handle Prisma P2025 error (record not found)', async () => {
        mockPrisma.storage.update.mockRejectedValue({ code: 'P2025' });
        await expect(
          service.updateFile('nonexistent', { filename: 'new.mp3' }),
        ).rejects.toThrow('File with ID nonexistent not found');
      });

      it('should handle general database errors', async () => {
        mockPrisma.storage.update.mockRejectedValue(
          new Error('DB constraint violation'),
        );
        await expect(
          service.updateFile('1', { filename: 'new.mp3' }),
        ).rejects.toThrow('Failed to update file record');
      });
    });

    describe('getPresignedUrl errors', () => {
      it('should handle R2 presigned URL generation failure', async () => {
        const mockRecord = { id: '1', url: 'https://r2.com/bucket/file.mp3' };
        mockPrisma.storage.findUnique.mockResolvedValue(mockRecord);
        mockR2.getPresignedUrl.mockRejectedValue(
          new Error('R2 presign failed'),
        );
        await expect(service.getPresignedUrl('1')).rejects.toThrow(
          'Failed to generate presigned URL',
        );
      });

      it('should handle file with invalid URL structure', async () => {
        const mockRecord = { id: '1', url: '' };
        mockPrisma.storage.findUnique.mockResolvedValue(mockRecord);
        await expect(service.getPresignedUrl('1')).rejects.toThrow(
          'Invalid file key extracted from URL',
        );
      });
    });

    describe('listFiles errors', () => {
      it('should handle database query failure', async () => {
        mockPrisma.storage.findMany.mockRejectedValue(new Error('DB timeout'));
        await expect(service.listFiles()).rejects.toThrow(
          'Failed to retrieve files from database',
        );
      });
    });
  });
});
