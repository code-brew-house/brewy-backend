import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { JobStatus } from '../../../generated/prisma';

describe('JobsService', () => {
  let service: JobsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    job: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new job with pending status', async () => {
      const fileId = 'test-file-id';
      const mockJob = {
        id: 'job-id',
        fileId,
        status: JobStatus.pending,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
        error: null,
      };

      mockPrismaService.job.create.mockResolvedValue(mockJob);

      const result = await service.create(fileId);

      expect(mockPrismaService.job.create).toHaveBeenCalledWith({
        data: {
          fileId,
          status: JobStatus.pending,
        },
      });
      expect(result).toEqual(mockJob);
    });
  });

  describe('findById', () => {
    it('should return a job when found', async () => {
      const jobId = 'test-job-id';
      const mockJob = {
        id: jobId,
        fileId: 'file-id',
        status: JobStatus.pending,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
        error: null,
        storage: {
          id: 'file-id',
          filename: 'test.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
        results: [],
      };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);

      const result = await service.findById(jobId);

      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: jobId },
        include: {
          storage: true,
          results: true,
        },
      });
      expect(result).toEqual(mockJob);
    });

    it('should throw NotFoundException when job not found', async () => {
      const jobId = 'nonexistent-job-id';
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(service.findById(jobId)).rejects.toThrow(
        new NotFoundException(`Job with ID ${jobId} not found`),
      );
    });
  });

  describe('updateStatus', () => {
    it('should update job status to processing and set startedAt', async () => {
      const jobId = 'test-job-id';
      const status = JobStatus.processing;
      const mockJob = {
        id: jobId,
        status,
        updatedAt: expect.any(Date),
        startedAt: expect.any(Date),
      };

      mockPrismaService.job.update.mockResolvedValue(mockJob);

      const result = await service.updateStatus(jobId, status);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: {
          status,
          updatedAt: expect.any(Date),
          startedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockJob);
    });

    it('should update job status to completed and set completedAt', async () => {
      const jobId = 'test-job-id';
      const status = JobStatus.completed;
      const mockJob = {
        id: jobId,
        status,
        updatedAt: expect.any(Date),
        completedAt: expect.any(Date),
      };

      mockPrismaService.job.update.mockResolvedValue(mockJob);

      const result = await service.updateStatus(jobId, status);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: {
          status,
          updatedAt: expect.any(Date),
          completedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockJob);
    });

    it('should update job status to failed with error message', async () => {
      const jobId = 'test-job-id';
      const status = JobStatus.failed;
      const error = 'Processing failed';
      const mockJob = {
        id: jobId,
        status,
        error,
        updatedAt: expect.any(Date),
        completedAt: expect.any(Date),
      };

      mockPrismaService.job.update.mockResolvedValue(mockJob);

      const result = await service.updateStatus(jobId, status, error);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: {
          status,
          error,
          updatedAt: expect.any(Date),
          completedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockJob);
    });
  });

  describe('findAll', () => {
    it('should return all jobs when no status filter', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          status: JobStatus.pending,
          storage: { filename: 'test1.mp3' },
        },
        {
          id: 'job-2',
          status: JobStatus.completed,
          storage: { filename: 'test2.mp3' },
        },
      ];

      mockPrismaService.job.findMany.mockResolvedValue(mockJobs);

      const result = await service.findAll();

      expect(mockPrismaService.job.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: {
          storage: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual(mockJobs);
    });

    it('should return filtered jobs when status provided', async () => {
      const status = JobStatus.pending;
      const mockJobs = [
        {
          id: 'job-1',
          status: JobStatus.pending,
          storage: { filename: 'test1.mp3' },
        },
      ];

      mockPrismaService.job.findMany.mockResolvedValue(mockJobs);

      const result = await service.findAll(status);

      expect(mockPrismaService.job.findMany).toHaveBeenCalledWith({
        where: { status },
        include: {
          storage: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual(mockJobs);
    });
  });

  describe('delete', () => {
    it('should delete a job', async () => {
      const jobId = 'test-job-id';
      const mockJob = {
        id: jobId,
        fileId: 'file-id',
        status: JobStatus.pending,
      };

      mockPrismaService.job.delete.mockResolvedValue(mockJob);

      const result = await service.delete(jobId);

      expect(mockPrismaService.job.delete).toHaveBeenCalledWith({
        where: { id: jobId },
      });
      expect(result).toEqual(mockJob);
    });
  });
});