import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * AnalysisResultsService handles CRUD operations for audio analysis results.
 * Manages storage and retrieval of transcript, sentiment, and metadata from Assembly AI.
 */
@Injectable()
export class AnalysisResultsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new analysis result for a job
   */
  async create(data: {
    jobId: string;
    transcript: string;
    sentiment: string;
    metadata?: any;
  }) {
    const result = await this.prisma.analysisResult.create({
      data: {
        jobId: data.jobId,
        transcript: data.transcript,
        sentiment: data.sentiment,
        metadata: data.metadata,
      },
    });
    return result;
  }

  /**
   * Find analysis result by job ID
   */
  async findByJobId(jobId: string) {
    const result = await this.prisma.analysisResult.findFirst({
      where: { jobId },
      include: {
        job: {
          include: {
            storage: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException(`Analysis result for job ${jobId} not found`);
    }

    return result;
  }

  /**
   * Find analysis result by its ID
   */
  async findById(id: string) {
    const result = await this.prisma.analysisResult.findUnique({
      where: { id },
      include: {
        job: {
          include: {
            storage: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException(`Analysis result with ID ${id} not found`);
    }

    return result;
  }

  /**
   * Update analysis result
   */
  async update(id: string, data: {
    transcript?: string;
    sentiment?: string;
    metadata?: any;
  }) {
    const result = await this.prisma.analysisResult.update({
      where: { id },
      data,
    });

    return result;
  }

  /**
   * Delete analysis result by ID
   */
  async delete(id: string) {
    const result = await this.prisma.analysisResult.delete({
      where: { id },
    });

    return result;
  }

  /**
   * Find all analysis results with optional job filtering
   */
  async findAll(jobId?: string) {
    const results = await this.prisma.analysisResult.findMany({
      where: jobId ? { jobId } : undefined,
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

    return results;
  }
}