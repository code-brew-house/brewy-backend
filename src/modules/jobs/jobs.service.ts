import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobStatus } from '../../../generated/prisma';

/**
 * JobsService handles CRUD operations for job management.
 * Provides methods to create, find, update status, and manage jobs.
 */
@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new job for a file
   */
  async create(fileId: string) {
    const job = await this.prisma.job.create({
      data: {
        fileId,
        status: JobStatus.pending,
      },
    });
    return job;
  }

  /**
   * Find a job by its ID
   */
  async findById(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        storage: true,
        results: true,
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
   * Find all jobs with optional filtering
   */
  async findAll(status?: JobStatus) {
    const jobs = await this.prisma.job.findMany({
      where: status ? { status } : undefined,
      include: {
        storage: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return jobs;
  }

  /**
   * Delete a job by ID
   */
  async delete(id: string) {
    const job = await this.prisma.job.delete({
      where: { id },
    });

    return job;
  }
}
