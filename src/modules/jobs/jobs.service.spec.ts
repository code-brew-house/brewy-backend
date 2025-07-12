import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JobStatus } from '../../../generated/prisma';
import {
  ConcurrentJobLimitExceededException,
  OrganizationNotFoundForLimitException,
} from '../organization/exceptions/organization-limits.exception';

describe('JobsService', () => {
  let service: JobsService;

  const mockPrismaService = {
    job: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    storage: {
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  };

  const mockOrganization = {
    id: 'org-123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Organization',
    maxConcurrentJobs: 5,
  };

  const mockStorage = {
    id: 'storage-123',
    filename: 'test.mp3',
    url: 'https://r2.example.com/test.mp3',
    organizationId: mockOrganization.id,
  };

  const mockJob = {
    id: 'job-123',
    fileId: mockStorage.id,
    organizationId: mockOrganization.id,
    status: JobStatus.pending,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    error: null,
    storage: mockStorage,
    organization: mockOrganization,
  };

  const mockAnotherOrgJob = {
    id: 'job-456',
    fileId: 'storage-456',
    organizationId: 'org-different',
    status: JobStatus.pending,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    error: null,
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new job with organization validation', async () => {
      mockPrismaService.storage.findUnique.mockResolvedValue(mockStorage);
      mockPrismaService.organization.findUnique.mockResolvedValue(
        mockOrganization,
      );
      mockPrismaService.job.count.mockResolvedValue(2); // Current active jobs
      mockPrismaService.job.create.mockResolvedValue(mockJob);

      const result = await service.create(mockStorage.id, mockOrganization.id);

      expect(mockPrismaService.storage.findUnique).toHaveBeenCalledWith({
        where: { id: mockStorage.id },
        select: { organizationId: true },
      });
      expect(mockPrismaService.job.create).toHaveBeenCalledWith({
        data: {
          fileId: mockStorage.id,
          organizationId: mockOrganization.id,
          status: JobStatus.pending,
        },
        include: {
          storage: {
            select: {
              id: true,
              filename: true,
              url: true,
              organizationId: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      expect(result).toEqual(mockJob);
    });

    it('should throw NotFoundException if file not found', async () => {
      mockPrismaService.storage.findUnique.mockResolvedValue(null);

      await expect(
        service.create('nonexistent-file', mockOrganization.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if file belongs to different organization', async () => {
      const differentOrgFile = {
        ...mockStorage,
        organizationId: 'org-different',
      };
      mockPrismaService.storage.findUnique.mockResolvedValue(differentOrgFile);

      await expect(
        service.create(mockStorage.id, mockOrganization.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConcurrentJobLimitExceededException when concurrent job limit is exceeded', async () => {
      mockPrismaService.storage.findUnique.mockResolvedValue(mockStorage);
      mockPrismaService.organization.findUnique.mockResolvedValue(
        mockOrganization,
      );
      mockPrismaService.job.count.mockResolvedValue(5); // At limit

      await expect(
        service.create(mockStorage.id, mockOrganization.id),
      ).rejects.toThrow(ConcurrentJobLimitExceededException);
      expect(mockPrismaService.job.create).not.toHaveBeenCalled();
    });

    it('should throw OrganizationNotFoundForLimitException when organization not found during job limit check', async () => {
      mockPrismaService.storage.findUnique.mockResolvedValue(mockStorage);
      mockPrismaService.organization.findUnique.mockResolvedValue(null); // Organization not found

      await expect(
        service.create(mockStorage.id, mockOrganization.id),
      ).rejects.toThrow(OrganizationNotFoundForLimitException);
      expect(mockPrismaService.job.create).not.toHaveBeenCalled();
    });

    it('should use default limit when organization maxConcurrentJobs is null', async () => {
      mockPrismaService.storage.findUnique.mockResolvedValue(mockStorage);
      mockPrismaService.organization.findUnique.mockResolvedValue({
        ...mockOrganization,
        maxConcurrentJobs: null, // Will use default of 5
      });
      mockPrismaService.job.count.mockResolvedValue(5); // At default limit

      await expect(
        service.create(mockStorage.id, mockOrganization.id),
      ).rejects.toThrow(ConcurrentJobLimitExceededException);
    });

    it('should allow job creation when under concurrent job limit', async () => {
      mockPrismaService.storage.findUnique.mockResolvedValue(mockStorage);
      mockPrismaService.organization.findUnique.mockResolvedValue(
        mockOrganization,
      );
      mockPrismaService.job.count.mockResolvedValue(2); // Under limit
      mockPrismaService.job.create.mockResolvedValue(mockJob);

      const result = await service.create(mockStorage.id, mockOrganization.id);

      expect(result).toEqual(mockJob);
      expect(mockPrismaService.job.create).toHaveBeenCalled();
    });

    it('should count only pending and processing jobs for limit check', async () => {
      mockPrismaService.storage.findUnique.mockResolvedValue(mockStorage);
      mockPrismaService.organization.findUnique.mockResolvedValue(
        mockOrganization,
      );
      mockPrismaService.job.count.mockResolvedValue(3); // Under limit
      mockPrismaService.job.create.mockResolvedValue(mockJob);

      await service.create(mockStorage.id, mockOrganization.id);

      expect(mockPrismaService.job.count).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrganization.id,
          status: {
            in: [JobStatus.pending, JobStatus.processing],
          },
        },
      });
    });
  });

  describe('findById', () => {
    it('should return a job when found within organization', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);

      const result = await service.findById(mockJob.id, mockOrganization.id);

      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: mockJob.id, organizationId: mockOrganization.id },
        include: {
          storage: {
            select: {
              id: true,
              filename: true,
              url: true,
              size: true,
              mimetype: true,
              organizationId: true,
            },
          },
          results: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      expect(result).toEqual(mockJob);
    });

    it('should throw BadRequestException if organization ID is missing', async () => {
      await expect(service.findById('job-id', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when job not found in organization', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(
        service.findById('nonexistent-job-id', mockOrganization.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent cross-organization job access', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(
        service.findById(mockAnotherOrgJob.id, mockOrganization.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findJobById (SUPER_OWNER)', () => {
    it('should return job without organization restriction', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);

      const result = await service.findJobById(mockJob.id);

      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: mockJob.id },
        include: {
          storage: {
            select: {
              id: true,
              filename: true,
              url: true,
              size: true,
              mimetype: true,
              organizationId: true,
            },
          },
          results: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      expect(result).toEqual(mockJob);
    });
  });

  describe('findAll', () => {
    it('should return jobs filtered by organization', async () => {
      const mockJobs = [mockJob];
      mockPrismaService.job.findMany.mockResolvedValue(mockJobs);
      mockPrismaService.job.count.mockResolvedValue(1);

      const result = await service.findAll(mockOrganization.id);

      expect(mockPrismaService.job.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganization.id },
        include: {
          storage: {
            select: {
              id: true,
              filename: true,
              url: true,
              size: true,
              mimetype: true,
              organizationId: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
        skip: 0,
      });
      expect(result.jobs).toEqual(mockJobs);
      expect(result.total).toBe(1);
    });

    it('should throw BadRequestException if organization ID is missing', async () => {
      await expect(service.findAll('')).rejects.toThrow(BadRequestException);
    });

    it('should prevent cross-organization data access', async () => {
      const orgJobs = [mockJob];
      mockPrismaService.job.findMany.mockResolvedValue(orgJobs);
      mockPrismaService.job.count.mockResolvedValue(1);

      const result = await service.findAll(mockOrganization.id);

      expect(result.jobs).toEqual(orgJobs);
      expect(result.jobs).not.toContain(mockAnotherOrgJob);
    });

    it('should return filtered jobs when status provided', async () => {
      const status = JobStatus.pending;
      const mockJobs = [mockJob];
      mockPrismaService.job.findMany.mockResolvedValue(mockJobs);
      mockPrismaService.job.count.mockResolvedValue(1);

      const result = await service.findAll(mockOrganization.id, status);

      expect(mockPrismaService.job.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganization.id, status },
        include: {
          storage: {
            select: {
              id: true,
              filename: true,
              url: true,
              size: true,
              mimetype: true,
              organizationId: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
        skip: 0,
      });
      expect(result.jobs).toEqual(mockJobs);
    });
  });

  describe('findAllJobs (SUPER_OWNER)', () => {
    it('should return all jobs across organizations', async () => {
      const allJobs = [mockJob, mockAnotherOrgJob];
      mockPrismaService.job.findMany.mockResolvedValue(allJobs);
      mockPrismaService.job.count.mockResolvedValue(2);

      const result = await service.findAllJobs();

      expect(mockPrismaService.job.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          storage: {
            select: {
              id: true,
              filename: true,
              url: true,
              size: true,
              mimetype: true,
              organizationId: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
        skip: 0,
      });
      expect(result.jobs).toEqual(allJobs);
      expect(result.total).toBe(2);
    });
  });

  describe('updateStatus', () => {
    it('should update job status to processing and set startedAt', async () => {
      const status = JobStatus.processing;
      const updatedJob = {
        ...mockJob,
        status,
        updatedAt: expect.any(Date),
        startedAt: expect.any(Date),
      };

      mockPrismaService.job.update.mockResolvedValue(updatedJob);

      const result = await service.updateStatus(mockJob.id, status);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: mockJob.id },
        data: {
          status,
          updatedAt: expect.any(Date),
          startedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedJob);
    });

    it('should update job status to completed and set completedAt', async () => {
      const status = JobStatus.completed;
      const updatedJob = {
        ...mockJob,
        status,
        updatedAt: expect.any(Date),
        completedAt: expect.any(Date),
      };

      mockPrismaService.job.update.mockResolvedValue(updatedJob);

      const result = await service.updateStatus(mockJob.id, status);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: mockJob.id },
        data: {
          status,
          updatedAt: expect.any(Date),
          completedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedJob);
    });

    it('should update job status to failed with error message', async () => {
      const status = JobStatus.failed;
      const error = 'Processing failed';
      const updatedJob = {
        ...mockJob,
        status,
        error,
        updatedAt: expect.any(Date),
        completedAt: expect.any(Date),
      };

      mockPrismaService.job.update.mockResolvedValue(updatedJob);

      const result = await service.updateStatus(mockJob.id, status, error);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: mockJob.id },
        data: {
          status,
          error,
          updatedAt: expect.any(Date),
          completedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedJob);
    });
  });

  describe('delete', () => {
    it('should delete a job within organization', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.job.delete.mockResolvedValue(mockJob);

      const result = await service.delete(mockJob.id, mockOrganization.id);

      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: mockJob.id, organizationId: mockOrganization.id },
      });
      expect(mockPrismaService.job.delete).toHaveBeenCalledWith({
        where: { id: mockJob.id },
      });
      expect(result).toEqual(mockJob);
    });

    it('should throw BadRequestException if organization ID is missing', async () => {
      await expect(service.delete('job-id', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent cross-organization job deletion', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(
        service.delete(mockAnotherOrgJob.id, mockOrganization.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrganizationJobStats', () => {
    it('should return job statistics for organization', async () => {
      mockPrismaService.job.groupBy.mockResolvedValue([
        { status: JobStatus.pending, _count: { status: 2 } },
        { status: JobStatus.completed, _count: { status: 3 } },
      ]);
      mockPrismaService.job.count.mockResolvedValue(2);
      mockPrismaService.organization.findUnique.mockResolvedValue(
        mockOrganization,
      );

      const result = await service.getOrganizationJobStats(mockOrganization.id);

      expect(result).toEqual({
        stats: {
          [JobStatus.pending]: 2,
          [JobStatus.completed]: 3,
        },
        activeJobCount: 2,
        maxConcurrentJobs: 5,
      });
    });

    it('should throw OrganizationNotFoundForLimitException when organization not found', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrganizationJobStats('nonexistent-org-id'),
      ).rejects.toThrow(OrganizationNotFoundForLimitException);
    });

    it('should use default limit when organization maxConcurrentJobs is null', async () => {
      mockPrismaService.job.groupBy.mockResolvedValue([]);
      mockPrismaService.job.count.mockResolvedValue(0);
      mockPrismaService.organization.findUnique.mockResolvedValue({
        ...mockOrganization,
        maxConcurrentJobs: null, // Will use default of 5
      });

      const result = await service.getOrganizationJobStats(mockOrganization.id);

      expect(result.maxConcurrentJobs).toBe(5); // Default limit
    });
  });

  describe('validateJobAccess', () => {
    it('should allow SUPER_OWNER to access any job', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);

      const result = await service.validateJobAccess(
        mockJob.id,
        'any-org-id',
        'SUPER_OWNER',
      );

      expect(result).toBe(true);
      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: mockJob.id },
      });
    });

    it('should restrict other users to their organization', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);

      const result = await service.validateJobAccess(
        mockJob.id,
        mockOrganization.id,
        'ADMIN',
      );

      expect(result).toBe(true);
      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockJob.id,
          organizationId: mockOrganization.id,
        },
      });
    });

    it('should deny access to jobs from different organization', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      const result = await service.validateJobAccess(
        mockAnotherOrgJob.id,
        mockOrganization.id,
        'ADMIN',
      );

      expect(result).toBe(false);
    });
  });

  describe('Organization Context and Data Isolation', () => {
    it('should ensure all operations are organization-scoped', async () => {
      // Test that all main operations require organizationId
      await expect(service.findById('id', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findAll('')).rejects.toThrow(BadRequestException);
      await expect(service.delete('id', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent data leakage between organizations', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(
        service.findById(mockAnotherOrgJob.id, mockOrganization.id),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockAnotherOrgJob.id,
          organizationId: mockOrganization.id,
        },
        include: {
          storage: {
            select: {
              id: true,
              filename: true,
              url: true,
              size: true,
              mimetype: true,
              organizationId: true,
            },
          },
          results: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should validate file organization membership on job creation', async () => {
      const differentOrgFile = {
        ...mockStorage,
        organizationId: 'org-different',
      };
      mockPrismaService.storage.findUnique.mockResolvedValue(differentOrgFile);

      await expect(
        service.create(mockStorage.id, mockOrganization.id),
      ).rejects.toThrow('File does not belong to your organization');
    });
  });

  describe('Error Handling', () => {
    it('should handle job not found during status update', async () => {
      const notFoundError = new Error('Record not found');
      Object.assign(notFoundError, { code: 'P2025' });
      mockPrismaService.job.update.mockRejectedValue(notFoundError);

      await expect(
        service.updateStatus('nonexistent-job-id', JobStatus.completed),
      ).rejects.toThrow('Record not found');
    });

    it('should handle database transaction failure', async () => {
      const transactionError = new Error('Transaction failed');
      mockPrismaService.job.update.mockRejectedValue(transactionError);

      await expect(
        service.updateStatus(mockJob.id, JobStatus.failed),
      ).rejects.toThrow('Transaction failed');
    });
  });
});
