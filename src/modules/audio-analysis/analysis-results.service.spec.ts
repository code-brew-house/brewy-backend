import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisResultsService } from './analysis-results.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AnalysisResultsService', () => {
  let service: AnalysisResultsService;

  const mockPrismaService = {
    analysisResult: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisResultsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AnalysisResultsService>(AnalysisResultsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new analysis result', async () => {
      const createData = {
        jobId: 'job-id',
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
      };

      const mockResult = {
        id: 'result-id',
        ...createData,
        createdAt: new Date(),
      };

      mockPrismaService.analysisResult.create.mockResolvedValue(mockResult);

      const result = await service.create(createData);

      expect(mockPrismaService.analysisResult.create).toHaveBeenCalledWith({
        data: createData,
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle database constraint violation (duplicate result)', async () => {
      const createData = {
        jobId: 'job-id',
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
      };

      const constraintError = new Error('Unique constraint failed');
      Object.assign(constraintError, { code: 'P2002' });
      mockPrismaService.analysisResult.create.mockRejectedValue(
        constraintError,
      );

      await expect(service.create(createData)).rejects.toThrow(
        'Unique constraint failed',
      );
    });

    it('should handle database connection errors', async () => {
      const createData = {
        jobId: 'job-id',
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
      };

      const connectionError = new Error('Connection timed out');
      mockPrismaService.analysisResult.create.mockRejectedValue(
        connectionError,
      );

      await expect(service.create(createData)).rejects.toThrow(
        'Connection timed out',
      );
    });

    it('should handle foreign key constraint violation', async () => {
      const createData = {
        jobId: 'nonexistent-job-id',
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
      };

      const fkError = new Error('Foreign key constraint failed');
      Object.assign(fkError, { code: 'P2003' });
      mockPrismaService.analysisResult.create.mockRejectedValue(fkError);

      await expect(service.create(createData)).rejects.toThrow(
        'Foreign key constraint failed',
      );
    });

    it('should handle missing required fields in create data', async () => {
      const incompleteData = {
        jobId: 'job-id',
        // transcript missing
        sentiment: 'positive',
      };

      const requiredFieldError = new Error('Field "transcript" is required');
      mockPrismaService.analysisResult.create.mockRejectedValue(
        requiredFieldError,
      );

      await expect(service.create(incompleteData as any)).rejects.toThrow(
        'Field "transcript" is required',
      );
    });

    it('should handle JSON metadata validation', async () => {
      const createData = {
        jobId: 'job-id',
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: {
          confidence: 0.95,
          complexObject: {
            nested: { deeply: { value: 'test' } },
            array: [1, 2, 3, { key: 'value' }],
            nullValue: null,
            booleanValue: true,
          },
        },
      };

      const mockResult = {
        id: 'result-id',
        ...createData,
        createdAt: new Date(),
      };

      mockPrismaService.analysisResult.create.mockResolvedValue(mockResult);

      const result = await service.create(createData);

      expect(mockPrismaService.analysisResult.create).toHaveBeenCalledWith({
        data: createData,
      });
      expect(result.metadata).toEqual(createData.metadata);
    });
  });

  describe('findById', () => {
    it('should return analysis result when found', async () => {
      const resultId = 'result-id';
      const mockResult = {
        id: resultId,
        jobId: 'job-id',
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
        createdAt: new Date(),
        job: {
          id: 'job-id',
          status: 'completed',
          storage: {
            filename: 'test.mp3',
            size: 1024,
          },
        },
      };

      mockPrismaService.analysisResult.findUnique.mockResolvedValue(mockResult);

      const result = await service.findById(resultId);

      expect(mockPrismaService.analysisResult.findUnique).toHaveBeenCalledWith({
        where: { id: resultId },
        include: {
          job: {
            include: {
              storage: true,
            },
          },
        },
      });
      expect(result).toEqual(mockResult);
    });

    it('should throw NotFoundException when result not found', async () => {
      const resultId = 'nonexistent-result-id';
      mockPrismaService.analysisResult.findUnique.mockResolvedValue(null);

      await expect(service.findById(resultId)).rejects.toThrow(
        new NotFoundException(`Analysis result with ID ${resultId} not found`),
      );
    });
  });

  describe('findByJobId', () => {
    it('should return analysis result for job when found', async () => {
      const jobId = 'job-id';
      const mockResult = {
        id: 'result-id',
        jobId,
        transcript: 'Test transcript',
        sentiment: 'positive',
        metadata: { confidence: 0.95 },
        createdAt: new Date(),
        job: {
          id: jobId,
          status: 'completed',
          storage: {
            filename: 'test.mp3',
            size: 1024,
          },
        },
      };

      mockPrismaService.analysisResult.findFirst.mockResolvedValue(mockResult);

      const result = await service.findByJobId(jobId);

      expect(mockPrismaService.analysisResult.findFirst).toHaveBeenCalledWith({
        where: { jobId },
        include: {
          job: {
            include: {
              storage: true,
            },
          },
        },
      });
      expect(result).toEqual(mockResult);
    });

    it('should throw NotFoundException when no result found for job', async () => {
      const jobId = 'job-without-results';
      mockPrismaService.analysisResult.findFirst.mockResolvedValue(null);

      await expect(service.findByJobId(jobId)).rejects.toThrow(
        new NotFoundException(`Analysis result for job ${jobId} not found`),
      );
    });
  });

  describe('findAll', () => {
    it('should return all analysis results', async () => {
      const mockResults = [
        {
          id: 'result-1',
          jobId: 'job-1',
          transcript: 'Test transcript 1',
          sentiment: 'positive',
          createdAt: new Date(),
        },
        {
          id: 'result-2',
          jobId: 'job-2',
          transcript: 'Test transcript 2',
          sentiment: 'negative',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.analysisResult.findMany.mockResolvedValue(mockResults);

      const result = await service.findAll();

      expect(mockPrismaService.analysisResult.findMany).toHaveBeenCalledWith({
        include: {
          job: {
            include: {
              storage: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual(mockResults);
    });
  });
});
