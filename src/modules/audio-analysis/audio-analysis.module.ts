import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AudioAnalysisService } from './audio-analysis.service';
import { AnalysisResultsService } from './analysis-results.service';
import { AudioAnalysisController } from './audio-analysis.controller';
import { AudioAnalysisWebhookController } from './audio-analysis-webhook.controller';
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { PrismaService } from '../../prisma/prisma.service';
import { N8NWebhookService } from './n8n-webhook.service';

/**
 * AudioAnalysisModule handles audio file upload, processing, and result management.
 * Integrates with N8N workflows for automated audio analysis via Assembly AI.
 */
@Module({
  imports: [ConfigModule, StorageModule, JobsModule],
  controllers: [AudioAnalysisController, AudioAnalysisWebhookController],
  providers: [
    AudioAnalysisService,
    AnalysisResultsService,
    PrismaService,
    N8NWebhookService,
  ],
  exports: [AudioAnalysisService, AnalysisResultsService],
})
export class AudioAnalysisModule {}
