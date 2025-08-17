import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AudioAnalysisService } from './audio-analysis.service';
import { JobStatusDto } from './dto/job-status.dto';
import { AnalysisResultsDto } from './dto/analysis-results.dto';
import {
  ListAnalysisResultsQueryDto,
  ListAnalysisResultsDto,
} from './dto/list-analysis-results.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Organization } from '../../common/decorators/organization.decorator';
import { RequestUser } from '../../common/types/request.types';

/**
 * AudioAnalysisController handles HTTP endpoints for audio analysis workflow
 * with organization-scoped access control and role-based permissions.
 * Provides endpoints for file upload, job status tracking, and result retrieval.
 */
@Controller('audio-analysis')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationGuard)
export class AudioAnalysisController {
  constructor(private readonly audioAnalysisService: AudioAnalysisService) {}

  /**
   * Upload audio file for analysis
   * @param file - MP3 audio file (max 20MB)
   * @param organizationId - Organization ID from authenticated user
   * @returns Job information with processing status
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN', 'AGENT')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024, // 20MB limit
      },
      fileFilter: (_, file, callback) => {
        // Allow MP3 files based on mimetype and extension
        const allowedMimeTypes = [
          'audio/mpeg',
          'audio/mp3',
          'audio/mpeg3',
          'audio/x-mpeg-3',
          'application/octet-stream',
        ];

        const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
        const hasMP3Extension = file.originalname
          ?.toLowerCase()
          .endsWith('.mp3');

        if (isValidMimeType || hasMP3Extension) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Only MP3 files are allowed'),
            false,
          );
        }
      },
    }),
  )
  async uploadAudio(
    @UploadedFile() file: Express.Multer.File,
    @Organization() organizationId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    try {
      return await this.audioAnalysisService.uploadAndProcess(
        file,
        organizationId,
      );
    } catch (error) {
      if (error.message?.includes('File size')) {
        throw new BadRequestException('File size exceeds 20MB limit');
      }
      if (error.message?.includes('Only MP3 files')) {
        throw new BadRequestException('Only MP3 files are allowed');
      }
      if (error.message?.includes('storage')) {
        throw new InternalServerErrorException('Failed to store file');
      }
      throw new InternalServerErrorException('Failed to process audio file');
    }
  }

  /**
   * Get job status by ID
   * @param jobId - UUID of the job to retrieve status for
   * @param user - Current authenticated user
   * @param organizationId - Organization ID from authenticated user
   * @returns Job status information including file details and timestamps
   */
  @Get('jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_OWNER', 'OWNER', 'ADMIN', 'AGENT')
  async getJobStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: RequestUser,
    @Organization() organizationId: string,
  ): Promise<JobStatusDto> {
    try {
      const filterOrgId =
        user.role === 'SUPER_OWNER' ? undefined : organizationId;
      return await this.audioAnalysisService.getJobStatus(jobId, filterOrgId);
    } catch (error) {
      if (error.message?.includes('not found')) {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }
      throw new InternalServerErrorException('Failed to retrieve job status');
    }
  }

  /**
   * Get analysis results by job ID
   * @param jobId - UUID of the job to retrieve analysis results for
   * @param user - Current authenticated user
   * @param organizationId - Organization ID from authenticated user
   * @returns Analysis results including transcript, sentiment, and metadata
   */
  @Get('jobs/:jobId/results')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_OWNER', 'OWNER', 'ADMIN', 'AGENT')
  async getAnalysisResults(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: RequestUser,
    @Organization() organizationId: string,
  ): Promise<AnalysisResultsDto> {
    try {
      const filterOrgId =
        user.role === 'SUPER_OWNER' ? undefined : organizationId;
      return await this.audioAnalysisService.getAnalysisResults(
        jobId,
        filterOrgId,
      );
    } catch (error) {
      if (error.message?.includes('not found')) {
        throw new NotFoundException(
          `Analysis results for job ${jobId} not found`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to retrieve analysis results',
      );
    }
  }

  /**
   * Get all analysis results for the organization with pagination
   * @param query - Pagination and sorting query parameters
   * @param user - Current authenticated user
   * @param organizationId - Organization ID from authenticated user
   * @returns Paginated list of analysis results
   */
  @Get('results')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_OWNER', 'OWNER', 'ADMIN', 'AGENT')
  async getAllAnalysisResults(
    @Query() query: ListAnalysisResultsQueryDto,
    @CurrentUser() user: RequestUser,
    @Organization() organizationId: string,
  ): Promise<ListAnalysisResultsDto> {
    try {
      const filterOrgId =
        user.role === 'SUPER_OWNER' ? undefined : organizationId;
      return await this.audioAnalysisService.getAllAnalysisResults(
        query,
        filterOrgId,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to retrieve analysis results',
      );
    }
  }
}
