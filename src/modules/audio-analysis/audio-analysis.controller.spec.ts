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
    processWebhookCallback: jest.fn(),
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

      const result = await controller.uploadAudio(mockFile);

      expect(mockAudioAnalysisService.uploadAndProcess).toHaveBeenCalledWith(
        mockFile,
      );
      expect(result).toEqual(mockUploadResponse);
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(controller.uploadAudio(null as any)).rejects.toThrow(
        new BadRequestException('Audio file is required'),
      );

      expect(mockAudioAnalysisService.uploadAndProcess).not.toHaveBeenCalled();
    });

    it('should handle file size error from service', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockRejectedValue(
        new Error('File size must be 20MB or less'),
      );

      await expect(controller.uploadAudio(mockFile)).rejects.toThrow(
        new BadRequestException('File size exceeds 20MB limit'),
      );
    });

    it('should handle MP3 format error from service', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockRejectedValue(
        new Error('Only MP3 files are allowed'),
      );

      await expect(controller.uploadAudio(mockFile)).rejects.toThrow(
        new BadRequestException('Only MP3 files are allowed'),
      );
    });

    it('should handle storage error from service', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockRejectedValue(
        new Error('Failed to upload to storage'),
      );

      await expect(controller.uploadAudio(mockFile)).rejects.toThrow(
        new InternalServerErrorException('Failed to store file'),
      );
    });

    it('should handle generic errors from service', async () => {
      mockAudioAnalysisService.uploadAndProcess.mockRejectedValue(
        new Error('Unknown error'),
      );

      await expect(controller.uploadAudio(mockFile)).rejects.toThrow(
        new InternalServerErrorException('Failed to process audio file'),
      );
    });
  });

  describe('getJobStatus', () => {
    const jobId = '550e8400-e29b-41d4-a716-446655440000';
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

      const result = await controller.getJobStatus(jobId);

      expect(mockAudioAnalysisService.getJobStatus).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(mockJobStatus);
    });

    it('should throw NotFoundException when job is not found', async () => {
      mockAudioAnalysisService.getJobStatus.mockRejectedValue(
        new Error('Job with ID test-id not found'),
      );

      await expect(controller.getJobStatus(jobId)).rejects.toThrow(
        new NotFoundException(`Job with ID ${jobId} not found`),
      );
    });

    it('should handle generic errors from service', async () => {
      mockAudioAnalysisService.getJobStatus.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.getJobStatus(jobId)).rejects.toThrow(
        new InternalServerErrorException('Failed to retrieve job status'),
      );
    });
  });

  describe('getAnalysisResults', () => {
    const jobId = '550e8400-e29b-41d4-a716-446655440000';
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

      const result = await controller.getAnalysisResults(jobId);

      expect(mockAudioAnalysisService.getAnalysisResults).toHaveBeenCalledWith(
        jobId,
      );
      expect(result).toEqual(mockAnalysisResults);
    });

    it('should throw NotFoundException when analysis results are not found', async () => {
      mockAudioAnalysisService.getAnalysisResults.mockRejectedValue(
        new Error('Analysis result for job test-id not found'),
      );

      await expect(controller.getAnalysisResults(jobId)).rejects.toThrow(
        new NotFoundException(`Analysis results for job ${jobId} not found`),
      );
    });

    it('should handle generic errors from service', async () => {
      mockAudioAnalysisService.getAnalysisResults.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.getAnalysisResults(jobId)).rejects.toThrow(
        new InternalServerErrorException('Failed to retrieve analysis results'),
      );
    });
  });

  describe('processWebhook', () => {
    const mockWebhookData = {
      jobId: 'job-id',
      status: 'completed' as const,
      transcript: 'Test transcript',
      sentiment: 'positive',
      metadata: { confidence: 0.95 },
    };

    const mockHeaders = {
      'x-n8n-webhook-secret': 'test-secret',
    };

    const expectedResponse = {
      success: true,
      message: 'Webhook processed successfully',
    };

    beforeEach(() => {
      mockConfigService.get.mockReturnValue('test-secret');
      mockAudioAnalysisService.processWebhookCallback.mockResolvedValue({
        success: true,
      });
    });

    it('should process webhook callback successfully', async () => {
      const result = await controller.processWebhook(
        mockWebhookData,
        mockHeaders,
      );

      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).toHaveBeenCalledWith(mockWebhookData);
      expect(result).toEqual(expectedResponse);
    });

    it('should process webhook callback with uppercase header', async () => {
      const uppercaseHeaders = {
        'X-N8N-WEBHOOK-SECRET': 'test-secret',
      };

      const result = await controller.processWebhook(
        mockWebhookData,
        uppercaseHeaders,
      );

      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).toHaveBeenCalledWith(mockWebhookData);
      expect(result).toEqual(expectedResponse);
    });

    it('should throw BadRequestException with invalid webhook secret', async () => {
      const invalidHeaders = {
        'x-n8n-webhook-secret': 'wrong-secret',
      };

      await expect(
        controller.processWebhook(mockWebhookData, invalidHeaders),
      ).rejects.toThrow(new BadRequestException('Invalid webhook secret'));

      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).not.toHaveBeenCalled();
    });

    it('should process webhook when no secret is configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = await controller.processWebhook(mockWebhookData, {});

      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).toHaveBeenCalledWith(mockWebhookData);
      expect(result).toEqual(expectedResponse);
    });

    it('should throw NotFoundException when job is not found', async () => {
      mockAudioAnalysisService.processWebhookCallback.mockRejectedValue(
        new Error('Job not found'),
      );

      await expect(
        controller.processWebhook(mockWebhookData, mockHeaders),
      ).rejects.toThrow(
        new NotFoundException('Job not found for webhook processing'),
      );
    });

    it('should throw BadRequestException for validation errors', async () => {
      mockAudioAnalysisService.processWebhookCallback.mockRejectedValue(
        new Error('Missing required validation field'),
      );

      await expect(
        controller.processWebhook(mockWebhookData, mockHeaders),
      ).rejects.toThrow(
        new BadRequestException(
          'Invalid webhook payload: Missing required validation field',
        ),
      );
    });

    it('should handle generic errors from service', async () => {
      mockAudioAnalysisService.processWebhookCallback.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        controller.processWebhook(mockWebhookData, mockHeaders),
      ).rejects.toThrow(
        new InternalServerErrorException('Failed to process webhook callback'),
      );
    });

    it('should process failed webhook callback', async () => {
      const failedWebhookData = {
        jobId: 'job-id',
        status: 'failed' as const,
        error: 'Processing failed',
      };

      const result = await controller.processWebhook(
        failedWebhookData,
        mockHeaders,
      );

      expect(
        mockAudioAnalysisService.processWebhookCallback,
      ).toHaveBeenCalledWith(failedWebhookData);
      expect(result).toEqual(expectedResponse);
    });
  });
});
