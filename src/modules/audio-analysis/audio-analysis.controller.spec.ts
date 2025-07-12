import { Test, TestingModule } from '@nestjs/testing';
import { AudioAnalysisController } from './audio-analysis.controller';
import { AudioAnalysisService } from './audio-analysis.service';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JobStatus } from '../../../generated/prisma';

describe('AudioAnalysisController', () => {
  let controller: AudioAnalysisController;

  const mockAudioAnalysisService = {
    uploadAndProcess: jest.fn(),
    getJobStatus: jest.fn(),
    getAnalysisResults: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AudioAnalysisController],
      providers: [
        {
          provide: AudioAnalysisService,
          useValue: mockAudioAnalysisService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<AudioAnalysisController>(AudioAnalysisController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadAudio', () => {
    const mockFile = {
      originalname: 'test.mp3',
      mimetype: 'audio/mpeg',
      size: 1024 * 1024, // 1MB
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    const mockOrganizationId = 'org-id-123';

    const mockUploadResponse = {
      jobId: 'job-id',
      fileId: 'file-id',
      status: JobStatus.pending,
      message: 'File uploaded successfully, processing started',
    };

    it('should upload audio file and return job information', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockResolvedValue(
        mockUploadResponse,
      );

      const result = await controller.uploadAudio(mockFile, mockOrganizationId);

      expect(mockAudioAnalysisService.uploadAndProcess).toHaveBeenCalledWith(
        mockFile,
        mockOrganizationId,
      );
      expect(result).toEqual(mockUploadResponse);
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(
        controller.uploadAudio(null as any, mockOrganizationId),
      ).rejects.toThrow(new BadRequestException('Audio file is required'));

      expect(mockAudioAnalysisService.uploadAndProcess).not.toHaveBeenCalled();
    });

    it('should handle file size error from service', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockRejectedValue(
        new Error('File size must be 20MB or less'),
      );

      await expect(
        controller.uploadAudio(mockFile, mockOrganizationId),
      ).rejects.toThrow(
        new BadRequestException('File size exceeds 20MB limit'),
      );
    });

    it('should handle MP3 format error from service', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockRejectedValue(
        new Error('Only MP3 files are allowed'),
      );

      await expect(
        controller.uploadAudio(mockFile, mockOrganizationId),
      ).rejects.toThrow(new BadRequestException('Only MP3 files are allowed'));
    });

    it('should handle storage error from service', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockRejectedValue(
        new Error('Failed to upload to storage'),
      );

      await expect(
        controller.uploadAudio(mockFile, mockOrganizationId),
      ).rejects.toThrow(
        new InternalServerErrorException('Failed to store file'),
      );
    });

    it('should handle generic errors from service', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockRejectedValue(
        new Error('Unknown error'),
      );

      await expect(
        controller.uploadAudio(mockFile, mockOrganizationId),
      ).rejects.toThrow(
        new InternalServerErrorException('Failed to process audio file'),
      );
    });
  });

  describe('getJobStatus', () => {
    const jobId = '550e8400-e29b-41d4-a716-446655440000';
    const mockUser = {
      id: 'user-id',
      username: 'testuser',
      email: 'test@example.com',
      fullName: 'Test User',
      organizationId: 'org-id-123',
      role: 'ADMIN' as const,
    };
    const mockOrganizationId = 'org-id-123';
    const mockJobStatus = {
      id: jobId,
      status: JobStatus.completed,
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
      error: null,
      file: {
        id: 'file-id',
        filename: 'test.mp3',
        size: 1024,
        mimetype: 'audio/mpeg',
      },
    };

    it('should return job status for valid job ID', async () => {
      mockAudioAnalysisService.getJobStatus.mockResolvedValue(mockJobStatus);

      const result = await controller.getJobStatus(
        jobId,
        mockUser,
        mockOrganizationId,
      );

      expect(mockAudioAnalysisService.getJobStatus).toHaveBeenCalledWith(
        jobId,
        mockOrganizationId,
      );
      expect(result).toEqual(mockJobStatus);
    });

    it('should return job status for SUPER_OWNER without organization filter', async () => {
      const superOwnerUser = { ...mockUser, role: 'SUPER_OWNER' as const };
      mockAudioAnalysisService.getJobStatus.mockResolvedValue(mockJobStatus);

      const result = await controller.getJobStatus(
        jobId,
        superOwnerUser,
        mockOrganizationId,
      );

      expect(mockAudioAnalysisService.getJobStatus).toHaveBeenCalledWith(
        jobId,
        undefined,
      );
      expect(result).toEqual(mockJobStatus);
    });

    it('should throw NotFoundException when job is not found', async () => {
      mockAudioAnalysisService.getJobStatus.mockRejectedValue(
        new Error('Job with ID test-id not found'),
      );

      await expect(
        controller.getJobStatus(jobId, mockUser, mockOrganizationId),
      ).rejects.toThrow(
        new NotFoundException(`Job with ID ${jobId} not found`),
      );
    });

    it('should handle generic errors from service', async () => {
      mockAudioAnalysisService.getJobStatus.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        controller.getJobStatus(jobId, mockUser, mockOrganizationId),
      ).rejects.toThrow(
        new InternalServerErrorException('Failed to retrieve job status'),
      );
    });
  });

  describe('getAnalysisResults', () => {
    const jobId = '550e8400-e29b-41d4-a716-446655440000';
    const mockUser = {
      id: 'user-id',
      username: 'testuser',
      email: 'test@example.com',
      fullName: 'Test User',
      organizationId: 'org-id-123',
      role: 'ADMIN' as const,
    };
    const mockOrganizationId = 'org-id-123';
    const mockAnalysisResults = {
      id: 'result-id',
      jobId,
      transcript: 'Test transcript',
      sentiment: 'positive',
      metadata: { confidence: 0.95 },
      createdAt: new Date(),
      job: {
        id: jobId,
        status: JobStatus.completed,
        file: {
          filename: 'test.mp3',
          size: 1024,
        },
      },
    };

    it('should return analysis results for valid job ID', async () => {
      mockAudioAnalysisService.getAnalysisResults.mockResolvedValue(
        mockAnalysisResults,
      );

      const result = await controller.getAnalysisResults(
        jobId,
        mockUser,
        mockOrganizationId,
      );

      expect(mockAudioAnalysisService.getAnalysisResults).toHaveBeenCalledWith(
        jobId,
        mockOrganizationId,
      );
      expect(result).toEqual(mockAnalysisResults);
    });

    it('should return analysis results for SUPER_OWNER without organization filter', async () => {
      const superOwnerUser = { ...mockUser, role: 'SUPER_OWNER' as const };
      mockAudioAnalysisService.getAnalysisResults.mockResolvedValue(
        mockAnalysisResults,
      );

      const result = await controller.getAnalysisResults(
        jobId,
        superOwnerUser,
        mockOrganizationId,
      );

      expect(mockAudioAnalysisService.getAnalysisResults).toHaveBeenCalledWith(
        jobId,
        undefined,
      );
      expect(result).toEqual(mockAnalysisResults);
    });

    it('should throw NotFoundException when analysis results are not found', async () => {
      mockAudioAnalysisService.getAnalysisResults.mockRejectedValue(
        new Error('Analysis result for job test-id not found'),
      );

      await expect(
        controller.getAnalysisResults(jobId, mockUser, mockOrganizationId),
      ).rejects.toThrow(
        new NotFoundException(`Analysis results for job ${jobId} not found`),
      );
    });

    it('should handle generic errors from service', async () => {
      mockAudioAnalysisService.getAnalysisResults.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        controller.getAnalysisResults(jobId, mockUser, mockOrganizationId),
      ).rejects.toThrow(
        new InternalServerErrorException('Failed to retrieve analysis results'),
      );
    });
  });
});
