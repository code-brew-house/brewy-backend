import { Test, TestingModule } from '@nestjs/testing';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { UpdateStorageDto } from './dto/update-storage.dto';
import { BadRequestException } from '@nestjs/common';

const mockStorageService = {
  uploadFile: jest.fn(),
  listFiles: jest.fn(),
  getFile: jest.fn(),
  updateFile: jest.fn(),
  deleteFile: jest.fn(),
  getPresignedUrl: jest.fn(),
};

describe('StorageController', () => {
  let controller: StorageController;
  let service: typeof mockStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [{ provide: StorageService, useValue: mockStorageService }],
    }).compile();
    controller = module.get<StorageController>(StorageController);
    service = module.get(StorageService);
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload valid mp3 file', async () => {
      const file = {
        mimetype: 'audio/mpeg',
        size: 1024,
      } as Express.Multer.File;
      service.uploadFile.mockResolvedValue('result');
      await expect(controller.uploadFile(file)).resolves.toBe('result');
      expect(service.uploadFile).toHaveBeenCalledWith(file);
    });
    it('should reject non-mp3 file', async () => {
      const file = {
        mimetype: 'image/png',
        size: 1024,
      } as Express.Multer.File;
      await expect(controller.uploadFile(file)).rejects.toThrow(
        BadRequestException,
      );
    });
    it('should reject file over 50MB', async () => {
      const file = {
        mimetype: 'audio/mp3',
        size: 51 * 1024 * 1024,
      } as Express.Multer.File;
      await expect(controller.uploadFile(file)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listFiles', () => {
    it('should return list of files', async () => {
      service.listFiles.mockResolvedValue(['file1', 'file2']);
      await expect(controller.listFiles()).resolves.toEqual(['file1', 'file2']);
    });
  });

  describe('getFile', () => {
    it('should return file by id', async () => {
      service.getFile.mockResolvedValue('file');
      await expect(controller.getFile('id')).resolves.toBe('file');
      expect(service.getFile).toHaveBeenCalledWith('id');
    });
  });

  describe('updateFile', () => {
    it('should update file metadata', async () => {
      const dto: UpdateStorageDto = { filename: 'new.mp3' } as any;
      service.updateFile.mockResolvedValue('updated');
      await expect(controller.updateFile('id', dto)).resolves.toBe('updated');
      expect(service.updateFile).toHaveBeenCalledWith('id', dto);
    });
  });

  describe('deleteFile', () => {
    it('should delete file by id', async () => {
      service.deleteFile.mockResolvedValue('deleted');
      await expect(controller.deleteFile('id')).resolves.toBe('deleted');
      expect(service.deleteFile).toHaveBeenCalledWith('id');
    });
  });

  describe('getPresignedUrl', () => {
    it('should return presigned url', async () => {
      service.getPresignedUrl.mockResolvedValue('url');
      await expect(controller.getPresignedUrl('id')).resolves.toBe('url');
      expect(service.getPresignedUrl).toHaveBeenCalledWith('id');
    });
  });
});
