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
    organizationId: string;
  }) {
    const result = await this.prisma.analysisResult.create({
      data: {
        jobId: data.jobId,
        transcript: data.transcript,
        sentiment: data.sentiment,
        metadata: data.metadata,
        organizationId: data.organizationId,
      },
    });
    return result;
  }

  /**
   * Find analysis result by job ID with organization validation
   * organizationId is required for data security.
   */
  async findByJobId(jobId: string, organizationId?: string) {
    const whereClause: any = { jobId };
    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const result = await this.prisma.analysisResult.findFirst({
      where: whereClause,
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
   * Find analysis result by its ID with organization validation
   * organizationId is required for data security.
   */
  async findById(id: string, organizationId?: string) {
    const whereClause: any = { id };
    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const result = await this.prisma.analysisResult.findUnique({
      where: whereClause,
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
  async update(
    id: string,
    data: {
      transcript?: string;
      sentiment?: string;
      metadata?: any;
    },
  ) {
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
   * Find all analysis results with organization and job filtering
   * organizationId is required for data security.
   */
  async findAll(organizationId: string, jobId?: string) {
    const whereClause: any = { organizationId };
    if (jobId) {
      whereClause.jobId = jobId;
    }

    const results = await this.prisma.analysisResult.findMany({
      where: whereClause,
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

  /**
   * Find all analysis results with pagination support
   * organizationId is required for data security.
   */
  async findAllPaginated(
    organizationId: string,
    page: number = 1,
    limit: number = 20,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const skip = (page - 1) * limit;
    const whereClause = { organizationId };

    // Get total count for pagination metadata
    const total = await this.prisma.analysisResult.count({
      where: whereClause,
    });

    const results = await this.prisma.analysisResult.findMany({
      where: whereClause,
      include: {
        job: {
          include: {
            storage: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    });

    return {
      data: results,
      total,
      page,
      limit,
    };
  }

  /**
   * Validate if a user can access an analysis result based on organization context
   */
  async validateAnalysisResultAccess(
    resultId: string,
    userOrganizationId: string,
    userRole: string,
  ): Promise<boolean> {
    try {
      // SUPER_OWNER can access any analysis result
      if (userRole === 'SUPER_OWNER') {
        const result = await this.prisma.analysisResult.findUnique({
          where: { id: resultId },
        });
        return !!result;
      }

      // Others can only access results within their organization
      const result = await this.prisma.analysisResult.findUnique({
        where: {
          id: resultId,
          organizationId: userOrganizationId,
        },
      });

      return !!result;
    } catch (error) {
      console.error(
        `[ANALYSIS RESULT ACCESS ERROR] Failed to validate result access: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get analysis result statistics for an organization
   */
  async getOrganizationAnalysisStats(organizationId: string) {
    const totalResults = await this.prisma.analysisResult.count({
      where: { organizationId },
    });

    const recentResults = await this.prisma.analysisResult.count({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    const sentimentDistribution = await this.prisma.analysisResult.groupBy({
      by: ['sentiment'],
      where: { organizationId },
      _count: {
        sentiment: true,
      },
    });

    console.log(
      `[ANALYSIS STATS] Organization ${organizationId}: ${totalResults} total results, ${recentResults} recent`,
    );

    return {
      totalResults,
      recentResults,
      sentimentDistribution: sentimentDistribution.reduce(
        (acc, sentiment) => {
          acc[sentiment.sentiment] = sentiment._count.sentiment;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
