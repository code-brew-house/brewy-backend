import { Test, TestingModule } from '@nestjs/testing';
import { AudioAnalysisService } from './audio-analysis.service';
import { StorageService } from '../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { AnalysisResultsService } from './analysis-results.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { JobStatus } from '../../../generated/prisma';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AudioAnalysisService', () => {
  let service: AudioAnalysisService;
  let storageService: StorageService;
  let jobsService: JobsService;
  let analysisResultsService: AnalysisResultsService;
  let configService: ConfigService;

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

  const mockConfigService = {
    get: jest.fn(),
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
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AudioAnalysisService>(AudioAnalysisService);
    storageService = module.get<StorageService>(StorageService);
    jobsService = module.get<JobsService>(JobsService);
    analysisResultsService = module.get<AnalysisResultsService>(AnalysisResultsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockClear();
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
      mockedAxios.post.mockResolvedValue({ status: 200, data: { success: true } });
    });

    it('should successfully upload file and trigger N8N webhook', async () => {
      // Create a service instance with webhook URL configured
      mockConfigService.get.mockReturnValue('https://n8n.example.com/webhook');
      
      const moduleWithWebhook: TestingModule = await Test.createTestingModule({
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
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('https://n8n.example.com/webhook') },
          },
        ],
      }).compile();

      const serviceWithWebhook = moduleWithWebhook.get<AudioAnalysisService>(AudioAnalysisService);

      const result = await serviceWithWebhook.uploadAndProcess(mockFile);

      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(mockJobsService.create).toHaveBeenCalledWith(mockStorageRecord.id);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook',
        {
          jobId: mockJob.id,
          fileUrl: mockStorageRecord.url,
          timestamp: expect.any(String),
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
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

    it('should handle N8N webhook failure and update job status to failed', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      // Create a service instance with webhook URL configured
      const moduleWithWebhook: TestingModule = await Test.createTestingModule({
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
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('https://n8n.example.com/webhook') },
          },
        ],
      }).compile();

      const serviceWithWebhook = moduleWithWebhook.get<AudioAnalysisService>(AudioAnalysisService);

      await expect(serviceWithWebhook.uploadAndProcess(mockFile)).rejects.toThrow(
        new BadRequestException('Failed to trigger processing workflow'),
      );

      expect(mockJobsService.updateStatus).toHaveBeenCalledWith(
        mockJob.id,
        JobStatus.failed,
        'Failed to trigger N8N webhook: Network error',
      );
    });

    it('should skip webhook trigger when N8N_WEBHOOK_URL is not configured', async () => {
      // Create a new service instance with empty webhook URL
      const moduleWithEmptyUrl: TestingModule = await Test.createTestingModule({
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
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('') },
          },
        ],
      }).compile();

      const serviceWithEmptyUrl = moduleWithEmptyUrl.get<AudioAnalysisService>(AudioAnalysisService);

      const result = await serviceWithEmptyUrl.uploadAndProcess(mockFile);

      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(mockJobsService.updateStatus).not.toHaveBeenCalled();
      expect(result).toEqual({
        jobId: mockJob.id,
        fileId: mockStorageRecord.id,
        status: mockJob.status,
        message: 'File uploaded successfully, processing started',
      });
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

      expect(mockAnalysisResultsService.findByJobId).toHaveBeenCalledWith('job-id');
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
    it('should process completed webhook callback', async () => {
      const callbackData = {
        jobId: 'job-id',
        status: 'completed' as const,
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
      };

      const result = await service.processWebhookCallback(callbackData);

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

      expect(mockAnalysisResultsService.create).not.toHaveBeenCalled();
      expect(mockJobsService.updateStatus).toHaveBeenCalledWith(
        callbackData.jobId,
        JobStatus.failed,
        callbackData.error,
      );
      expect(result).toEqual({ success: true });
    });

    it('should not create analysis result when transcript or sentiment is missing', async () => {
      const callbackData = {
        jobId: 'job-id',
        status: 'completed' as const,
        transcript: undefined,
        sentiment: 'positive',
      };

      const result = await service.processWebhookCallback(callbackData);

      expect(mockAnalysisResultsService.create).not.toHaveBeenCalled();
      expect(mockJobsService.updateStatus).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });
});