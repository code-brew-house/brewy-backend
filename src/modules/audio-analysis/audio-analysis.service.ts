import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { JobStatus } from '../../../generated/prisma';
import { StorageService } from '../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { AnalysisResultsService } from './analysis-results.service';
import { N8NWebhookService } from './n8n-webhook.service';
import { N8NWebhookPayloadDto } from './dto/webhook.dto';

/**
 * AudioAnalysisService orchestrates the complete audio analysis workflow.
 * Handles file upload, job creation, validation, and N8N webhook triggers.
 */
@Injectable()
export class AudioAnalysisService {
  private readonly logger = new Logger(AudioAnalysisService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly jobsService: JobsService,
    private readonly analysisResultsService: AnalysisResultsService,
    private readonly n8nWebhookService: N8NWebhookService,
  ) {}

  /**
   * Upload and process audio file through the complete workflow
   */
  async uploadAndProcess(file: Express.Multer.File) {
    this.validateAudioFile(file);
    const storageRecord = await this.storageService.uploadFile(file);
    const job = await this.jobsService.create(storageRecord.id);
    const payload: N8NWebhookPayloadDto = {
      jobId: job.id,
      fileUrl: storageRecord.url,
      timestamp: new Date().toISOString(),
    };
    try {
      await this.n8nWebhookService.triggerWebhook(payload);
      await this.jobsService.updateStatus(job.id, JobStatus.processing);
    } catch (error) {
      this.logger.error(
        `Failed to trigger N8N webhook for job ${job.id}:`,
        error instanceof Error ? error.stack : error,
        payload,
      );
      await this.jobsService.updateStatus(
        job.id,
        JobStatus.failed,
        `Failed to trigger N8N webhook: ${error.message}`,
      );
      throw new BadRequestException('Failed to trigger processing workflow');
    }
    return {
      jobId: job.id,
      fileId: storageRecord.id,
      status: job.status,
      message: 'File uploaded successfully, processing started',
    };
  }

  /**
   * Validate audio file format and size
   */
  private validateAudioFile(file: Express.Multer.File) {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate file is not empty
    if (file.size === 0) {
      throw new BadRequestException('File is empty');
    }

    // Validate MP3 format
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mpeg3',
      'audio/x-mpeg-3',
      'application/octet-stream',
    ];

    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
    const hasMP3Extension = file.originalname?.toLowerCase().endsWith('.mp3');

    if (!isValidMimeType && !hasMP3Extension) {
      throw new BadRequestException('Only MP3 files are allowed');
    }

    // Validate file size (20MB max for audio analysis)
    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be 20MB or less');
    }
  }

  /**
   * Get job status with details
   */
  async getJobStatus(jobId: string) {
    const job = await this.jobsService.findById(jobId);

    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      file: {
        id: job.storage.id,
        filename: job.storage.filename,
        size: job.storage.size,
        mimetype: job.storage.mimetype,
      },
    };
  }

  /**
   * Get analysis results for a job
   */
  async getAnalysisResults(jobId: string) {
    const result = await this.analysisResultsService.findByJobId(jobId);

    return {
      id: result.id,
      jobId: result.jobId,
      transcript: result.transcript,
      sentiment: result.sentiment,
      metadata: result.metadata,
      createdAt: result.createdAt,
      job: {
        id: result.job.id,
        status: result.job.status,
        file: {
          filename: result.job.storage.filename,
          size: result.job.storage.size,
        },
      },
    };
  }

  /**
   * Process webhook callback from N8N
   */
  async processWebhookCallback(data: {
    jobId: string;
    status: 'completed' | 'failed';
    transcript?: string;
    sentiment?: string;
    metadata?: any;
    error?: string;
  }) {
    const { jobId, status, transcript, sentiment, metadata, error } = data;
    const job = await this.jobsService.findById(jobId);
    if (!job) {
      this.logger.warn(`Webhook callback for non-existent job: ${jobId}`);
      throw new BadRequestException('Job not found');
    }
    if (status === 'completed') {
      if (!transcript || !sentiment) {
        await this.jobsService.updateStatus(
          jobId,
          JobStatus.failed,
          'Missing transcript or sentiment in completed webhook',
        );
        this.logger.error(
          `Webhook callback missing transcript/sentiment for completed job: ${jobId}`,
        );
        throw new BadRequestException(
          'Missing transcript or sentiment for completed job',
        );
      }
      // Prevent duplicate analysis result creation
      let existingResult = null;
      try {
        existingResult = await this.analysisResultsService.findByJobId(jobId);
      } catch (err) {}
      if (!existingResult) {
        await this.analysisResultsService.create({
          jobId,
          transcript,
          sentiment,
          metadata,
        });
        this.logger.log(`Analysis result stored for job ${jobId}`);
      } else {
        this.logger.warn(
          `Analysis result already exists for job ${jobId}, skipping creation`,
        );
      }
      await this.jobsService.updateStatus(jobId, JobStatus.completed);
      this.logger.log(`Job ${jobId} marked as completed via webhook`);
    } else if (status === 'failed') {
      await this.jobsService.updateStatus(
        jobId,
        JobStatus.failed,
        error || 'Unknown error from N8N',
      );
      this.logger.log(`Job ${jobId} marked as failed via webhook: ${error}`);
    } else {
      this.logger.warn(
        `Webhook callback with unknown status for job: ${jobId}`,
      );
      await this.jobsService.updateStatus(
        jobId,
        JobStatus.failed,
        'Unknown status in webhook callback',
      );
      throw new BadRequestException('Unknown status in webhook callback');
    }
    return { success: true };
  }
}
