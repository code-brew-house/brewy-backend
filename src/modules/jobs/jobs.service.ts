import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobStatus } from '../../../generated/prisma';
import { ORGANIZATION_LIMITS } from '../organization/constants/organization.constants';
import {
  ConcurrentJobLimitExceededException,
  OrganizationNotFoundForLimitException,
} from '../organization/exceptions/organization-limits.exception';

/**
 * JobsService handles CRUD operations for job management with organization context.
 * Provides methods to create, find, update status, and manage jobs with concurrent limits.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new job for a file with organization context and concurrent job limits
   */
  async create(fileId: string, organizationId: string) {
    // Validate that the file belongs to the organization
    const file = await this.prisma.storage.findUnique({
      where: { id: fileId },
      select: { organizationId: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.organizationId !== organizationId) {
      throw new ForbiddenException('File does not belong to your organization');
    }

    // Check concurrent job limits for the organization
    await this.checkConcurrentJobLimit(organizationId);

    const job = await this.prisma.job.create({
      data: {
        fileId,
        organizationId,
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

    console.log(
      `[JOB CREATE] Job created: ${job.id} for organization: ${organizationId}`,
    );
    return job;
  }

  /**
   * Find a job by its ID with organization validation
   * organizationId is required for data security - use findJobById() for SUPER_OWNER access.
   */
  async findById(id: string, organizationId: string) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    const job = await this.prisma.job.findUnique({
      where: { id, organizationId },
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

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job;
  }

  /**
   * Update job status
   */
  async updateStatus(id: string, status: JobStatus, error?: string) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === JobStatus.processing && !error) {
      updateData.startedAt = new Date();
    }

    if (status === JobStatus.completed || status === JobStatus.failed) {
      updateData.completedAt = new Date();
    }

    if (error) {
      updateData.error = error;
    }

    const job = await this.prisma.job.update({
      where: { id },
      data: updateData,
    });

    return job;
  }

  /**
   * Find all jobs with optional filtering by organization and status
   * organizationId is required for data security - use findAllJobs() for SUPER_OWNER access.
   */
  async findAll(
    organizationId: string,
    status?: JobStatus,
    limit?: number,
    offset?: number,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    const whereClause: any = { organizationId };

    if (status) {
      whereClause.status = status;
    }

    const jobs = await this.prisma.job.findMany({
      where: whereClause,
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
      take: limit || 50,
      skip: offset || 0,
    });

    const total = await this.prisma.job.count({
      where: whereClause,
    });

    console.log(
      `[JOB FIND_ALL] Found ${jobs.length}/${total} jobs for organization: ${organizationId || 'all'}`,
    );

    return {
      jobs,
      total,
    };
  }

  /**
   * Delete a job by ID with organization validation
   * organizationId is required for data security.
   */
  async delete(id: string, organizationId: string) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    // First verify the job exists and belongs to the organization
    const existingJob = await this.prisma.job.findUnique({
      where: { id, organizationId },
    });

    if (!existingJob) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    const job = await this.prisma.job.delete({
      where: { id },
    });

    console.log(`[JOB DELETE] Job deleted: ${id}`);
    return job;
  }

  /**
   * Check concurrent job limits for an organization
   */
  private async checkConcurrentJobLimit(organizationId: string): Promise<void> {
    try {
      // Get organization's concurrent job limit
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          maxConcurrentJobs: true,
        },
      });

      if (!organization) {
        throw new OrganizationNotFoundForLimitException(organizationId);
      }

      const maxJobs =
        organization.maxConcurrentJobs ||
        ORGANIZATION_LIMITS.DEFAULT_MAX_CONCURRENT_JOBS;

      // Count currently running/processing jobs
      const activeJobCount = await this.prisma.job.count({
        where: {
          organizationId,
          status: {
            in: [JobStatus.pending, JobStatus.processing],
          },
        },
      });

      if (activeJobCount >= maxJobs) {
        throw new ConcurrentJobLimitExceededException(
          organizationId,
          activeJobCount,
          maxJobs,
        );
      }

      console.log(
        `[JOB LIMIT CHECK] Organization ${organizationId}: ${activeJobCount}/${maxJobs} active jobs`,
      );
    } catch (error) {
      console.error(
        `[JOB LIMIT ERROR] Failed to check concurrent job limit: ${error.message}`,
      );
      if (
        error instanceof ConcurrentJobLimitExceededException ||
        error instanceof OrganizationNotFoundForLimitException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to validate concurrent job limit: ' + error.message,
      );
    }
  }

  /**
   * Get job statistics for an organization
   */
  async getOrganizationJobStats(organizationId: string) {
    // Get organization's concurrent job limit
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        maxConcurrentJobs: true,
      },
    });

    if (!organization) {
      throw new OrganizationNotFoundForLimitException(organizationId);
    }

    const maxConcurrentJobs =
      organization.maxConcurrentJobs ||
      ORGANIZATION_LIMITS.DEFAULT_MAX_CONCURRENT_JOBS;

    const stats = await this.prisma.job.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: {
        status: true,
      },
    });

    const activeJobCount = await this.prisma.job.count({
      where: {
        organizationId,
        status: {
          in: [JobStatus.pending, JobStatus.processing],
        },
      },
    });

    console.log(
      `[JOB STATS] Organization ${organizationId}: ${activeJobCount}/${maxConcurrentJobs} active jobs`,
    );

    return {
      stats: stats.reduce(
        (acc, stat) => {
          acc[stat.status] = stat._count.status;
          return acc;
        },
        {} as Record<string, number>,
      ),
      activeJobCount,
      maxConcurrentJobs,
    };
  }

  /**
   * Validate if a user can access a job based on organization context
   */
  async validateJobAccess(
    jobId: string,
    userOrganizationId: string,
    userRole: string,
  ): Promise<boolean> {
    try {
      // SUPER_OWNER can access any job
      if (userRole === 'SUPER_OWNER') {
        const job = await this.prisma.job.findUnique({
          where: { id: jobId },
        });
        return !!job;
      }

      // Others can only access jobs within their organization
      const job = await this.prisma.job.findUnique({
        where: {
          id: jobId,
          organizationId: userOrganizationId,
        },
      });

      return !!job;
    } catch (error) {
      console.error(
        `[JOB ACCESS ERROR] Failed to validate job access: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * SUPER_OWNER only method to find a job by ID without organization restriction.
   * Should only be called from controllers with proper role validation.
   */
  async findJobById(id: string) {
    this.logger.log(`[FIND_JOB_BY_ID] Searching for job with ID: ${id}`);
    this.logger.log(`[FIND_JOB_BY_ID] ID type: ${typeof id}, length: ${id?.length}`);
    
    try {
      const job = await this.prisma.job.findUnique({
        where: { id },
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

      this.logger.log(`[FIND_JOB_BY_ID] Query result: ${job ? 'FOUND' : 'NOT_FOUND'}`);
      
      if (job) {
        this.logger.log(`[FIND_JOB_BY_ID] Found job: ${job.id}, status: ${job.status}, organizationId: ${job.organizationId}`);
      } else {
        // Let's also try to find any jobs with similar IDs for debugging
        this.logger.log(`[FIND_JOB_BY_ID] Searching for jobs with similar ID patterns...`);
        const similarJobs = await this.prisma.job.findMany({
          where: {
            OR: [
              { id: { contains: id.substring(0, 8) } },
              { id: { endsWith: id.substring(-8) } }
            ]
          },
          select: { id: true, status: true },
          take: 5
        });
        this.logger.log(`[FIND_JOB_BY_ID] Similar jobs found: ${JSON.stringify(similarJobs)}`);
        
        // Also check if there are any jobs at all
        const totalJobs = await this.prisma.job.count();
        this.logger.log(`[FIND_JOB_BY_ID] Total jobs in database: ${totalJobs}`);
      }

      if (!job) {
        this.logger.error(`[FIND_JOB_BY_ID] Job with ID ${id} not found`);
        throw new NotFoundException(`Job with ID ${id} not found`);
      }

      return job;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`[FIND_JOB_BY_ID] Database error: ${error.message}`);
      this.logger.error(`[FIND_JOB_BY_ID] Error stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * SUPER_OWNER only method to find all jobs across organizations.
   * Should only be called from controllers with proper role validation.
   */
  async findAllJobs(status?: JobStatus, limit?: number, offset?: number) {
    const whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    const jobs = await this.prisma.job.findMany({
      where: whereClause,
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
      take: limit || 50,
      skip: offset || 0,
    });

    const total = await this.prisma.job.count({
      where: whereClause,
    });

    console.log(
      `[JOB FIND_ALL_JOBS] Found ${jobs.length}/${total} jobs across all organizations`,
    );

    return {
      jobs,
      total,
    };
  }
}
