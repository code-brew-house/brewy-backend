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
      count: jest.fn(),
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
        organizationId: 'org-123',
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
        organizationId: 'org-123',
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
        organizationId: 'org-123',
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
        organizationId: 'org-123',
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
        organizationId: 'org-123',
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
        organizationId: 'org-123',
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

      const result = await service.findAll('org-123');

      expect(mockPrismaService.analysisResult.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
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

  describe('findAllPaginated', () => {
    it('should return paginated analysis results with default parameters', async () => {
      const organizationId = 'org-123';
      const mockCount = 25;
      const mockResults = [
        {
          id: 'result-1',
          jobId: 'job-1',
          organizationId,
          transcript: 'Test transcript 1',
          sentiment: 'positive',
          createdAt: new Date('2024-01-01'),
          job: {
            id: 'job-1',
            status: 'completed',
            storage: {
              filename: 'test1.mp3',
              size: 1024,
            },
          },
        },
        {
          id: 'result-2',
          jobId: 'job-2',
          organizationId,
          transcript: 'Test transcript 2',
          sentiment: 'negative',
          createdAt: new Date('2024-01-02'),
          job: {
            id: 'job-2',
            status: 'completed',
            storage: {
              filename: 'test2.mp3',
              size: 2048,
            },
          },
        },
      ];

      mockPrismaService.analysisResult.count.mockResolvedValue(mockCount);
      mockPrismaService.analysisResult.findMany.mockResolvedValue(mockResults);

      const result = await service.findAllPaginated(organizationId);

      expect(mockPrismaService.analysisResult.count).toHaveBeenCalledWith({
        where: { organizationId },
      });
      expect(mockPrismaService.analysisResult.findMany).toHaveBeenCalledWith({
        where: { organizationId },
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
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        data: mockResults,
        total: mockCount,
        page: 1,
        limit: 20,
      });
    });

    it('should return paginated analysis results with custom parameters', async () => {
      const organizationId = 'org-123';
      const page = 2;
      const limit = 10;
      const sortBy = 'createdAt';
      const sortOrder = 'asc';
      const mockCount = 25;
      const mockResults: any[] = [];

      mockPrismaService.analysisResult.count.mockResolvedValue(mockCount);
      mockPrismaService.analysisResult.findMany.mockResolvedValue(mockResults);

      const result = await service.findAllPaginated(
        organizationId,
        page,
        limit,
        sortBy,
        sortOrder,
      );

      expect(mockPrismaService.analysisResult.count).toHaveBeenCalledWith({
        where: { organizationId },
      });
      expect(mockPrismaService.analysisResult.findMany).toHaveBeenCalledWith({
        where: { organizationId },
        include: {
          job: {
            include: {
              storage: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        skip: 10, // (page - 1) * limit = (2 - 1) * 10
        take: 10,
      });
      expect(result).toEqual({
        data: mockResults,
        total: mockCount,
        page: 2,
        limit: 10,
      });
    });

    it('should handle empty results', async () => {
      const organizationId = 'org-empty';
      const mockCount = 0;
      const mockResults: any[] = [];

      mockPrismaService.analysisResult.count.mockResolvedValue(mockCount);
      mockPrismaService.analysisResult.findMany.mockResolvedValue(mockResults);

      const result = await service.findAllPaginated(organizationId);

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });
    });

    it('should handle database errors', async () => {
      const organizationId = 'org-123';
      const dbError = new Error('Database connection failed');

      mockPrismaService.analysisResult.count.mockRejectedValue(dbError);

      await expect(service.findAllPaginated(organizationId)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
