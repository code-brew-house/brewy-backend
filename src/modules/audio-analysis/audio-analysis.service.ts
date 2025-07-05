import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { JobStatus } from '../../../generated/prisma';
import { StorageService } from '../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { AnalysisResultsService } from './analysis-results.service';

/**
 * AudioAnalysisService orchestrates the complete audio analysis workflow.
 * Handles file upload, job creation, validation, and N8N webhook triggers.
 */
@Injectable()
export class AudioAnalysisService {
  private readonly logger = new Logger(AudioAnalysisService.name);
  private readonly n8nWebhookUrl: string;

  constructor(
    private readonly storageService: StorageService,
    private readonly jobsService: JobsService,
    private readonly analysisResultsService: AnalysisResultsService,
    private readonly configService: ConfigService,
  ) {
    this.n8nWebhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL') || '';
  }

  /**
   * Upload and process audio file through the complete workflow
   */
  async uploadAndProcess(file: Express.Multer.File) {
    // Validate file before processing
    this.validateAudioFile(file);

    // Upload file to storage
    const storageRecord = await this.storageService.uploadFile(file);

    // Create job for processing
    const job = await this.jobsService.create(storageRecord.id);

    // Trigger N8N webhook for processing
    await this.triggerN8NWebhook(job.id, storageRecord.url);
    
    return {
      jobId: job.id,
      fileId: storageRecord.id,
      status: job.status,
      message: 'File uploaded successfully, processing started',
    };
  }

  /**
   * Trigger N8N webhook for audio analysis processing
   */
  private async triggerN8NWebhook(jobId: string, fileUrl: string): Promise<void> {
    try {
      if (!this.n8nWebhookUrl) {
        this.logger.warn('N8N_WEBHOOK_URL not configured, skipping webhook trigger');
        return;
      }

      const payload = {
        jobId,
        fileUrl,
        timestamp: new Date().toISOString(),
      };

      this.logger.log(`Triggering N8N webhook for job ${jobId}`);
      
      const response = await axios.post(this.n8nWebhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.log(`N8N webhook triggered successfully for job ${jobId}`);
        // Update job status to processing
        await this.jobsService.updateStatus(jobId, JobStatus.processing);
      } else {
        throw new Error(`N8N webhook returned status ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Failed to trigger N8N webhook for job ${jobId}:`, error);
      
      // Update job status to failed
      await this.jobsService.updateStatus(
        jobId,
        JobStatus.failed,
        `Failed to trigger N8N webhook: ${error.message}`,
      );
      
      throw new BadRequestException('Failed to trigger processing workflow');
    }
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

    if (status === 'completed' && transcript && sentiment) {
      // Create analysis results
      await this.analysisResultsService.create({
        jobId,
        transcript,
        sentiment,
        metadata,
      });

      // Update job status to completed
      await this.jobsService.updateStatus(jobId, JobStatus.completed);
    } else if (status === 'failed') {
      // Update job status to failed with error
      await this.jobsService.updateStatus(jobId, JobStatus.failed, error);
    }

    return { success: true };
  }
}