import { Test, TestingModule } from '@nestjs/testing';
import { AudioAnalysisService } from './audio-analysis.service';
import { StorageService } from '../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { AnalysisResultsService } from './analysis-results.service';
import { N8NWebhookService } from './n8n-webhook.service';
import { BadRequestException } from '@nestjs/common';
import { JobStatus } from '../../../generated/prisma';

describe('AudioAnalysisService', () => {
  let service: AudioAnalysisService;

  const mockStorageService = {
    uploadFile: jest.fn(),
  };

  const mockJobsService = {
    create: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockAnalysisResultsService = {
    create: jest.fn(),
    findByJobId: jest.fn(),
  };

  const mockN8NWebhookService = {
    triggerWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioAnalysisService,
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
        {
          provide: AnalysisResultsService,
          useValue: mockAnalysisResultsService,
        },
        {
          provide: N8NWebhookService,
          useValue: mockN8NWebhookService,
        },
      ],
    }).compile();

    service = module.get<AudioAnalysisService>(AudioAnalysisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadAndProcess', () => {
    const mockFile = {
      originalname: 'test.mp3',
      mimetype: 'audio/mpeg',
      size: 1024 * 1024, // 1MB
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    const mockStorageRecord = {
      id: 'storage-id',
      url: 'https://example.com/test.mp3',
      filename: 'test.mp3',
      size: 1024 * 1024,
      mimetype: 'audio/mpeg',
    };

    const mockJob = {
      id: 'job-id',
      fileId: 'storage-id',
      status: JobStatus.pending,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockStorageService.uploadFile.mockResolvedValue(mockStorageRecord);
      mockJobsService.create.mockResolvedValue(mockJob);
      mockN8NWebhookService.triggerWebhook.mockResolvedValue({ success: true });
    });

    it('should successfully upload file and trigger N8N webhook', async () => {
      const result = await service.uploadAndProcess(mockFile);

      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(mockJobsService.create).toHaveBeenCalledWith(mockStorageRecord.id);
      expect(mockN8NWebhookService.triggerWebhook).toHaveBeenCalledWith({
        jobId: mockJob.id,
        fileUrl: mockStorageRecord.url,
        timestamp: expect.any(String),
      });
      expect(mockJobsService.updateStatus).toHaveBeenCalledWith(
        mockJob.id,
        JobStatus.processing,
      );
      expect(result).toEqual({
        jobId: mockJob.id,
        fileId: mockStorageRecord.id,
        status: mockJob.status,
        message: 'File uploaded successfully, processing started',
      });
    });

    it('should throw BadRequestException when file is null', async () => {
      await expect(service.uploadAndProcess(null as any)).rejects.toThrow(
        new BadRequestException('File is required'),
      );
    });

    it('should throw BadRequestException when file is empty', async () => {
      const emptyFile = { ...mockFile, size: 0 };
      await expect(service.uploadAndProcess(emptyFile)).rejects.toThrow(
        new BadRequestException('File is empty'),
      );
    });

    it('should throw BadRequestException for non-MP3 files', async () => {
      const nonMp3File = {
        ...mockFile,
        originalname: 'test.wav',
        mimetype: 'audio/wav',
      };
      await expect(service.uploadAndProcess(nonMp3File)).rejects.toThrow(
        new BadRequestException('Only MP3 files are allowed'),
      );
    });

    it('should throw BadRequestException for files larger than 20MB', async () => {
      const largeFile = {
        ...mockFile,
        size: 21 * 1024 * 1024, // 21MB
      };
      await expect(service.uploadAndProcess(largeFile)).rejects.toThrow(
        new BadRequestException('File size must be 20MB or less'),
      );
    });

    it('should accept file exactly at 20MB limit', async () => {
      const maxSizeFile = {
        ...mockFile,
        size: 20 * 1024 * 1024, // Exactly 20MB
      };

      const result = await service.uploadAndProcess(maxSizeFile);

      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(maxSizeFile);
      expect(result).toEqual({
        jobId: mockJob.id,
        fileId: mockStorageRecord.id,
        status: mockJob.status,
        message: 'File uploaded successfully, processing started',
      });
    });

    it('should accept MP3 file with alternative mime type', async () => {
      const alternativeMimeFile = {
        ...mockFile,
        mimetype: 'audio/mp3',
      };

      const result = await service.uploadAndProcess(alternativeMimeFile);

      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        alternativeMimeFile,
      );
      expect(result).toEqual({
        jobId: mockJob.id,
        fileId: mockStorageRecord.id,
        status: mockJob.status,
        message: 'File uploaded successfully, processing started',
      });
    });

    it('should accept MP3 file with octet-stream mime type but .mp3 extension', async () => {
      const octetStreamFile = {
        ...mockFile,
        mimetype: 'application/octet-stream',
        originalname: 'test.mp3',
      };

      const result = await service.uploadAndProcess(octetStreamFile);

      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        octetStreamFile,
      );
      expect(result).toEqual({
        jobId: mockJob.id,
        fileId: mockStorageRecord.id,
        status: mockJob.status,
        message: 'File uploaded successfully, processing started',
      });
    });

    it('should accept file with valid mime type even with wrong extension', async () => {
      const wrongExtensionFile = {
        ...mockFile,
        originalname: 'test.wav',
        mimetype: 'audio/mpeg',
      };

      const result = await service.uploadAndProcess(wrongExtensionFile);

      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        wrongExtensionFile,
      );
      expect(result).toEqual({
        jobId: mockJob.id,
        fileId: mockStorageRecord.id,
        status: mockJob.status,
        message: 'File uploaded successfully, processing started',
      });
    });

    it('should throw BadRequestException for invalid mime type and wrong extension', async () => {
      const invalidFile = {
        ...mockFile,
        originalname: 'test.wav',
        mimetype: 'audio/wav',
      };

      await expect(service.uploadAndProcess(invalidFile)).rejects.toThrow(
        new BadRequestException('Only MP3 files are allowed'),
      );
    });

    it('should handle N8N webhook failure and update job status to failed', async () => {
      mockN8NWebhookService.triggerWebhook.mockRejectedValue(
        new Error('Network error'),
      );

      await expect(service.uploadAndProcess(mockFile)).rejects.toThrow(
        new BadRequestException('Failed to trigger processing workflow'),
      );

      expect(mockJobsService.updateStatus).toHaveBeenCalledWith(
        mockJob.id,
        JobStatus.failed,
        'Failed to trigger N8N webhook: Network error',
      );
    });

    it('should handle storage service failure', async () => {
      mockStorageService.uploadFile.mockRejectedValue(
        new Error('Storage unavailable'),
      );

      await expect(service.uploadAndProcess(mockFile)).rejects.toThrow(
        'Storage unavailable',
      );
    });

    it('should handle job creation failure', async () => {
      mockJobsService.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(service.uploadAndProcess(mockFile)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle extremely large metadata', async () => {
      const largeMetadata = { data: 'x'.repeat(100000) };
      const fileWithLargeMetadata = { ...mockFile, metadata: largeMetadata };

      // Should still process normally
      const result = await service.uploadAndProcess(fileWithLargeMetadata);

      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        fileWithLargeMetadata,
      );
      expect(result).toEqual({
        jobId: mockJob.id,
        fileId: mockStorageRecord.id,
        status: mockJob.status,
        message: 'File uploaded successfully, processing started',
      });
    });

    it('should handle file with null originalname', async () => {
      const fileWithNullName = {
        ...mockFile,
        originalname: null as any,
        mimetype: 'audio/wav', // Also change mimetype so validation fails
      };

      await expect(service.uploadAndProcess(fileWithNullName)).rejects.toThrow(
        new BadRequestException('Only MP3 files are allowed'),
      );
    });

    it('should handle file with empty originalname', async () => {
      const fileWithEmptyName = {
        ...mockFile,
        originalname: '',
        mimetype: 'audio/wav', // Also change mimetype so validation fails
      };

      await expect(service.uploadAndProcess(fileWithEmptyName)).rejects.toThrow(
        new BadRequestException('Only MP3 files are allowed'),
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return formatted job status', async () => {
      const mockJob = {
        id: 'job-id',
        status: JobStatus.completed,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        error: null,
        storage: {
          id: 'storage-id',
          filename: 'test.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      };

      mockJobsService.findById.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-id');

      expect(mockJobsService.findById).toHaveBeenCalledWith('job-id');
      expect(result).toEqual({
        id: mockJob.id,
        status: mockJob.status,
        createdAt: mockJob.createdAt,
        updatedAt: mockJob.updatedAt,
        startedAt: mockJob.startedAt,
        completedAt: mockJob.completedAt,
        error: mockJob.error,
        file: {
          id: mockJob.storage.id,
          filename: mockJob.storage.filename,
          size: mockJob.storage.size,
          mimetype: mockJob.storage.mimetype,
        },
      });
    });
  });

  describe('getAnalysisResults', () => {
    it('should return formatted analysis results', async () => {
      const mockResult = {
        id: 'result-id',
        jobId: 'job-id',
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
        createdAt: new Date(),
        job: {
          id: 'job-id',
          status: JobStatus.completed,
          storage: {
            filename: 'test.mp3',
            size: 1024,
          },
        },
      };

      mockAnalysisResultsService.findByJobId.mockResolvedValue(mockResult);

      const result = await service.getAnalysisResults('job-id');

      expect(mockAnalysisResultsService.findByJobId).toHaveBeenCalledWith(
        'job-id',
      );
      expect(result).toEqual({
        id: mockResult.id,
        jobId: mockResult.jobId,
        transcript: mockResult.transcript,
        sentiment: mockResult.sentiment,
        metadata: mockResult.metadata,
        createdAt: mockResult.createdAt,
        job: {
          id: mockResult.job.id,
          status: mockResult.job.status,
          file: {
            filename: mockResult.job.storage.filename,
            size: mockResult.job.storage.size,
          },
        },
      });
    });
  });

  describe('processWebhookCallback', () => {
    const mockJob = {
      id: 'job-id',
      status: JobStatus.processing,
      storage: { filename: 'test.mp3' },
    };

    beforeEach(() => {
      mockJobsService.findById.mockResolvedValue(mockJob);
    });

    it('should process completed webhook callback', async () => {
      const callbackData = {
        jobId: 'job-id',
        status: 'completed' as const,
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
      };

      mockAnalysisResultsService.findByJobId.mockRejectedValue(
        new Error('Not found'),
      );

      const result = await service.processWebhookCallback(callbackData);

      expect(mockJobsService.findById).toHaveBeenCalledWith('job-id');
      expect(mockAnalysisResultsService.create).toHaveBeenCalledWith({
        jobId: callbackData.jobId,
        transcript: callbackData.transcript,
        sentiment: callbackData.sentiment,
        metadata: callbackData.metadata,
      });
      expect(mockJobsService.updateStatus).toHaveBeenCalledWith(
        callbackData.jobId,
        JobStatus.completed,
      );
      expect(result).toEqual({ success: true });
    });

    it('should process failed webhook callback', async () => {
      const callbackData = {
        jobId: 'job-id',
        status: 'failed' as const,
        error: 'Processing failed',
      };

      const result = await service.processWebhookCallback(callbackData);

      expect(mockJobsService.findById).toHaveBeenCalledWith('job-id');
      expect(mockAnalysisResultsService.create).not.toHaveBeenCalled();
      expect(mockJobsService.updateStatus).toHaveBeenCalledWith(
        callbackData.jobId,
        JobStatus.failed,
        callbackData.error,
      );
      expect(result).toEqual({ success: true });
    });

    it('should fail when transcript or sentiment is missing in completed callback', async () => {
      const callbackData = {
        jobId: 'job-id',
        status: 'completed' as const,
        transcript: undefined,
        sentiment: 'positive',
      };

      await expect(
        service.processWebhookCallback(callbackData),
      ).rejects.toThrow(
        new BadRequestException(
          'Missing transcript or sentiment for completed job',
        ),
      );

      expect(mockJobsService.updateStatus).toHaveBeenCalledWith(
        'job-id',
        JobStatus.failed,
        'Missing transcript or sentiment in completed webhook',
      );
    });

    it('should skip creating duplicate analysis result', async () => {
      const callbackData = {
        jobId: 'job-id',
        status: 'completed' as const,
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
      };

      const existingResult = { id: 'existing-result-id', jobId: 'job-id' };
      mockAnalysisResultsService.findByJobId.mockResolvedValue(existingResult);

      const result = await service.processWebhookCallback(callbackData);

      expect(mockAnalysisResultsService.create).not.toHaveBeenCalled();
      expect(mockJobsService.updateStatus).toHaveBeenCalledWith(
        callbackData.jobId,
        JobStatus.completed,
      );
      expect(result).toEqual({ success: true });
    });

    it('should fail when job is not found', async () => {
      mockJobsService.findById.mockResolvedValue(null);

      const callbackData = {
        jobId: 'nonexistent-job-id',
        status: 'completed' as const,
        transcript: 'Test transcript',
        sentiment: 'positive',
      };

      await expect(
        service.processWebhookCallback(callbackData),
      ).rejects.toThrow(new BadRequestException('Job not found'));
    });

    it('should fail with unknown status', async () => {
      const callbackData = {
        jobId: 'job-id',
        status: 'unknown' as any,
      };

      await expect(
        service.processWebhookCallback(callbackData),
      ).rejects.toThrow(
        new BadRequestException('Unknown status in webhook callback'),
      );

      expect(mockJobsService.updateStatus).toHaveBeenCalledWith(
        'job-id',
        JobStatus.failed,
        'Unknown status in webhook callback',
      );
    });

    it('should handle database errors during webhook processing', async () => {
      const callbackData = {
        jobId: 'job-id',
        status: 'completed' as const,
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
      };

      mockAnalysisResultsService.findByJobId.mockRejectedValue(
        new Error('Not found'),
      );
      mockAnalysisResultsService.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.processWebhookCallback(callbackData),
      ).rejects.toThrow('Database error');
    });

    it('should handle malformed metadata in webhook callback', async () => {
      const callbackData = {
        jobId: 'job-id-metadata',
        status: 'completed' as const,
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: null, // Invalid metadata
      };

      mockAnalysisResultsService.findByJobId.mockRejectedValue(
        new Error('Not found'),
      );
      mockAnalysisResultsService.create.mockResolvedValue({
        id: 'result-id',
      } as any);

      const result = await service.processWebhookCallback(callbackData);

      expect(mockAnalysisResultsService.create).toHaveBeenCalledWith({
        jobId: callbackData.jobId,
        transcript: callbackData.transcript,
        sentiment: callbackData.sentiment,
        metadata: null,
      });
      expect(result).toEqual({ success: true });
    });

    it('should handle extremely long transcript in webhook callback', async () => {
      const callbackData = {
        jobId: 'job-id-long',
        status: 'completed' as const,
        transcript: 'A'.repeat(50000), // Very long transcript
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
      };

      mockAnalysisResultsService.findByJobId.mockRejectedValue(
        new Error('Not found'),
      );
      mockAnalysisResultsService.create.mockResolvedValue({
        id: 'result-id',
      } as any);

      const result = await service.processWebhookCallback(callbackData);

      expect(mockAnalysisResultsService.create).toHaveBeenCalledWith({
        jobId: callbackData.jobId,
        transcript: callbackData.transcript,
        sentiment: callbackData.sentiment,
        metadata: callbackData.metadata,
      });
      expect(result).toEqual({ success: true });
    });

    it('should handle job service failure during status update', async () => {
      const callbackData = {
        jobId: 'job-id-status-fail',
        status: 'completed' as const,
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
      };

      mockAnalysisResultsService.findByJobId.mockRejectedValue(
        new Error('Not found'),
      );
      mockAnalysisResultsService.create.mockResolvedValue({
        id: 'result-id',
      } as any);
      mockJobsService.updateStatus.mockRejectedValue(
        new Error('Status update failed'),
      );

      await expect(
        service.processWebhookCallback(callbackData),
      ).rejects.toThrow('Status update failed');
    });
  });
});
