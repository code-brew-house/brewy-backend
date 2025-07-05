import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AudioAnalysisService } from './audio-analysis.service';
import { JobStatusDto } from './dto/job-status.dto';
import { AnalysisResultsDto } from './dto/analysis-results.dto';
import { N8NWebhookCallbackDto, WebhookResponseDto } from './dto/webhook.dto';
import { ConfigService } from '@nestjs/config';

/**
 * AudioAnalysisController handles HTTP endpoints for audio analysis workflow.
 * Provides endpoints for file upload, job status tracking, and result retrieval.
 */
@Controller('audio-analysis')
export class AudioAnalysisController {
  constructor(
    private readonly audioAnalysisService: AudioAnalysisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Upload audio file for analysis
   * @param file - MP3 audio file (max 20MB)
   * @returns Job information with processing status
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
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
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    try {
      return await this.audioAnalysisService.uploadAndProcess(file);
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
   * @returns Job status information including file details and timestamps
   */
  @Get('jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  async getJobStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<JobStatusDto> {
    try {
      return await this.audioAnalysisService.getJobStatus(jobId);
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
   * @returns Analysis results including transcript, sentiment, and metadata
   */
  @Get('jobs/:jobId/results')
  @HttpCode(HttpStatus.OK)
  async getAnalysisResults(
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<AnalysisResultsDto> {
    try {
      return await this.audioAnalysisService.getAnalysisResults(jobId);
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
   * Webhook endpoint for N8N callbacks
   * @param data - Webhook payload from N8N containing job results or error information
   * @returns Success response indicating webhook was processed
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  )
  async processWebhook(
    @Body() data: N8NWebhookCallbackDto,
    @Headers() headers: Record<string, string>,
  ): Promise<WebhookResponseDto> {
    const expectedSecret = this.configService.get<string>('N8N_WEBHOOK_SECRET');
    const receivedSecret =
      headers['x-n8n-webhook-secret'] || headers['X-N8N-WEBHOOK-SECRET'];
    if (expectedSecret && receivedSecret !== expectedSecret) {
      throw new BadRequestException('Invalid webhook secret');
    }
    try {
      await this.audioAnalysisService.processWebhookCallback(data);
      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      if (error.message?.includes('not found')) {
        throw new NotFoundException(`Job not found for webhook processing`);
      }
      if (error.message?.includes('validation')) {
        throw new BadRequestException(
          `Invalid webhook payload: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to process webhook callback',
      );
    }
  }
}
