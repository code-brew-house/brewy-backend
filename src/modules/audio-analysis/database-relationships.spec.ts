import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { JobStatus } from '../../../generated/prisma';
import { ConfigService } from '@nestjs/config';

/**
 * Database Relationship and Constraint Tests
 *
 * This test suite validates database relationships, foreign key constraints,
 * and other database-level validations for the audio analysis feature.
 */
describe('Database Relationships and Constraints', () => {
  let prismaService: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
          },
        },
      ],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);

    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prismaService.$disconnect();
  });

  const cleanupTestData = async () => {
    try {
      // Clean up in reverse dependency order
      await prismaService.analysisResult.deleteMany({
        where: {
          job: {
            storage: {
              filename: { contains: 'test-db-relationship' },
            },
          },
        },
      });

      await prismaService.job.deleteMany({
        where: {
          storage: {
            filename: { contains: 'test-db-relationship' },
          },
        },
      });

      await prismaService.storage.deleteMany({
        where: {
          filename: { contains: 'test-db-relationship' },
        },
      });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  };

  describe('Storage → Job Relationship', () => {
    it('should create job with valid storage reference', async () => {
      // Create storage record
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-db-relationship-1.mp3',
          filename: 'test-db-relationship-1.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      // Create job referencing the storage
      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.pending,
        },
      });

      expect(job.fileId).toBe(storage.id);

      // Verify relationship works both ways
      const jobWithStorage = await prismaService.job.findUnique({
        where: { id: job.id },
        include: { storage: true },
      });

      expect(jobWithStorage?.storage.filename).toBe(
        'test-db-relationship-1.mp3',
      );
    });

    it('should reject job creation with invalid storage reference', async () => {
      const invalidStorageId = 'invalid-uuid-format';

      await expect(
        prismaService.job.create({
          data: {
            fileId: invalidStorageId,
            status: JobStatus.pending,
          },
        }),
      ).rejects.toThrow();
    });

    it('should reject job creation with non-existent storage ID', async () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

      await expect(
        prismaService.job.create({
          data: {
            fileId: nonExistentId,
            status: JobStatus.pending,
          },
        }),
      ).rejects.toThrow();
    });

    it('should allow multiple jobs for same storage file', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-db-relationship-multiple.mp3',
          filename: 'test-db-relationship-multiple.mp3',
          size: 2048,
          mimetype: 'audio/mpeg',
        },
      });

      const job1 = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.pending,
        },
      });

      const job2 = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.processing,
        },
      });

      expect(job1.fileId).toBe(storage.id);
      expect(job2.fileId).toBe(storage.id);
      expect(job1.id).not.toBe(job2.id);
    });
  });

  describe('Job → AnalysisResult Relationship', () => {
    it('should create analysis result with valid job reference', async () => {
      // Create storage and job
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-db-relationship-2.mp3',
          filename: 'test-db-relationship-2.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.completed,
        },
      });

      // Create analysis result
      const result = await prismaService.analysisResult.create({
        data: {
          jobId: job.id,
          transcript: 'Test transcript for relationship testing',
          sentiment: 'positive',
          metadata: { confidence: 0.95, duration: 120 },
        },
      });

      expect(result.jobId).toBe(job.id);

      // Verify relationship works both ways
      const resultWithJob = await prismaService.analysisResult.findUnique({
        where: { id: result.id },
        include: {
          job: {
            include: { storage: true },
          },
        },
      });

      expect(resultWithJob?.job.id).toBe(job.id);
      expect(resultWithJob?.job.storage.filename).toBe(
        'test-db-relationship-2.mp3',
      );
    });

    it('should reject analysis result with non-existent job ID', async () => {
      const nonExistentJobId = '550e8400-e29b-41d4-a716-446655440000';

      await expect(
        prismaService.analysisResult.create({
          data: {
            jobId: nonExistentJobId,
            transcript: 'Test transcript',
            sentiment: 'positive',
          },
        }),
      ).rejects.toThrow();
    });

    it('should allow multiple analysis results for same job', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-db-relationship-multiple-results.mp3',
          filename: 'test-db-relationship-multiple-results.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.completed,
        },
      });

      const result1 = await prismaService.analysisResult.create({
        data: {
          jobId: job.id,
          transcript: 'First analysis',
          sentiment: 'positive',
        },
      });

      const result2 = await prismaService.analysisResult.create({
        data: {
          jobId: job.id,
          transcript: 'Second analysis',
          sentiment: 'negative',
        },
      });

      expect(result1.jobId).toBe(job.id);
      expect(result2.jobId).toBe(job.id);
      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('JobStatus Enum Constraints', () => {
    it('should accept valid JobStatus values', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-db-relationship-enum.mp3',
          filename: 'test-db-relationship-enum.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const validStatuses = [
        JobStatus.pending,
        JobStatus.processing,
        JobStatus.completed,
        JobStatus.failed,
      ];

      for (const status of validStatuses) {
        const job = await prismaService.job.create({
          data: {
            fileId: storage.id,
            status,
          },
        });

        expect(job.status).toBe(status);
      }
    });

    it('should have pending as default status', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-db-relationship-default.mp3',
          filename: 'test-db-relationship-default.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          // Not specifying status to test default
        },
      });

      expect(job.status).toBe(JobStatus.pending);
    });
  });

  describe('Required Field Constraints', () => {
    it('should require filename for storage', async () => {
      await expect(
        prismaService.storage.create({
          data: {
            url: 'https://example.com/test.mp3',
            // filename missing
            size: 1024,
            mimetype: 'audio/mpeg',
          } as any,
        }),
      ).rejects.toThrow();
    });

    it('should require transcript for analysis result', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-db-relationship-required.mp3',
          filename: 'test-db-relationship-required.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.completed,
        },
      });

      await expect(
        prismaService.analysisResult.create({
          data: {
            jobId: job.id,
            // transcript missing
            sentiment: 'positive',
          } as any,
        }),
      ).rejects.toThrow();
    });

    it('should require sentiment for analysis result', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-db-relationship-sentiment.mp3',
          filename: 'test-db-relationship-sentiment.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.completed,
        },
      });

      await expect(
        prismaService.analysisResult.create({
          data: {
            jobId: job.id,
            transcript: 'Test transcript',
            // sentiment missing
          } as any,
        }),
      ).rejects.toThrow();
    });
  });

  describe('UUID Primary Key Constraints', () => {
    it('should generate unique UUIDs for storage records', async () => {
      const storage1 = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-uuid-1.mp3',
          filename: 'test-db-relationship-uuid-1.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const storage2 = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-uuid-2.mp3',
          filename: 'test-db-relationship-uuid-2.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      expect(storage1.id).not.toBe(storage2.id);
      expect(storage1.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(storage2.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('should generate unique UUIDs for job records', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-job-uuid.mp3',
          filename: 'test-db-relationship-job-uuid.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job1 = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.pending,
        },
      });

      const job2 = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.pending,
        },
      });

      expect(job1.id).not.toBe(job2.id);
      expect(job1.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(job2.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe('Metadata JSON Field', () => {
    it('should store complex JSON metadata', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-metadata.mp3',
          filename: 'test-db-relationship-metadata.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.completed,
        },
      });

      const complexMetadata = {
        confidence: 0.95,
        duration: 120,
        language: 'en',
        speakers: [
          { id: 1, confidence: 0.9 },
          { id: 2, confidence: 0.8 },
        ],
        timestamps: [
          { start: 0, end: 30, text: 'Hello world' },
          { start: 31, end: 60, text: 'This is a test' },
        ],
        analysis: {
          emotions: ['happy', 'neutral'],
          keywords: ['test', 'audio', 'analysis'],
          summary: 'A test audio file for relationship testing',
        },
      };

      const result = await prismaService.analysisResult.create({
        data: {
          jobId: job.id,
          transcript: 'Complex metadata test',
          sentiment: 'positive',
          metadata: complexMetadata,
        },
      });

      expect(result.metadata).toEqual(complexMetadata);
    });

    it('should handle null metadata', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-null-metadata.mp3',
          filename: 'test-db-relationship-null-metadata.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.completed,
        },
      });

      const result = await prismaService.analysisResult.create({
        data: {
          jobId: job.id,
          transcript: 'Null metadata test',
          sentiment: 'neutral',
          // metadata field omitted to test null default
        },
      });

      expect(result.metadata).toBeNull();
    });
  });

  describe('Cascade Behavior and Data Integrity', () => {
    it('should maintain referential integrity when deleting storage', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-cascade.mp3',
          filename: 'test-db-relationship-cascade.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.completed,
        },
      });

      // Trying to delete storage that has dependent jobs should fail
      await expect(
        prismaService.storage.delete({
          where: { id: storage.id },
        }),
      ).rejects.toThrow();

      // Job should still exist
      const existingJob = await prismaService.job.findUnique({
        where: { id: job.id },
      });
      expect(existingJob).not.toBeNull();
    });

    it('should maintain referential integrity when deleting job with analysis results', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-job-cascade.mp3',
          filename: 'test-db-relationship-job-cascade.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.completed,
        },
      });

      const result = await prismaService.analysisResult.create({
        data: {
          jobId: job.id,
          transcript: 'Cascade test',
          sentiment: 'positive',
        },
      });

      // Trying to delete job that has dependent analysis results should fail
      await expect(
        prismaService.job.delete({
          where: { id: job.id },
        }),
      ).rejects.toThrow();

      // Analysis result should still exist
      const existingResult = await prismaService.analysisResult.findUnique({
        where: { id: result.id },
      });
      expect(existingResult).not.toBeNull();
    });
  });

  describe('Timestamp Constraints', () => {
    it('should automatically set timestamps', async () => {
      const beforeCreate = new Date();

      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-timestamps.mp3',
          filename: 'test-db-relationship-timestamps.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.pending,
        },
      });

      const result = await prismaService.analysisResult.create({
        data: {
          jobId: job.id,
          transcript: 'Timestamp test',
          sentiment: 'positive',
        },
      });

      const afterCreate = new Date();

      // Verify timestamps are set and within expected range
      expect(storage.timestamp).toBeInstanceOf(Date);
      expect(storage.timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(storage.timestamp.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime(),
      );

      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.updatedAt).toBeInstanceOf(Date);
      expect(job.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(job.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(result.createdAt.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime(),
      );
    });

    it('should update job updatedAt on status change', async () => {
      const storage = await prismaService.storage.create({
        data: {
          url: 'https://example.com/test-updated-at.mp3',
          filename: 'test-db-relationship-updated-at.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
        },
      });

      const job = await prismaService.job.create({
        data: {
          fileId: storage.id,
          status: JobStatus.pending,
        },
      });

      const originalUpdatedAt = job.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updatedJob = await prismaService.job.update({
        where: { id: job.id },
        data: { status: JobStatus.processing },
      });

      expect(updatedJob.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });
});
