import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  HttpStatus,
  HttpCode,
  Headers,
  Logger,
} from '@nestjs/common';
import { AudioAnalysisService } from './audio-analysis.service';
import { N8NWebhookCallbackDto, WebhookResponseDto } from './dto/webhook.dto';
import { ConfigService } from '@nestjs/config';

/**
 * AudioAnalysisWebhookController handles webhook callbacks from N8N without authentication.
 * This is separated from the main controller to bypass organization guards for internal webhooks.
 */
@Controller('audio-analysis')
export class AudioAnalysisWebhookController {
  private readonly logger = new Logger(AudioAnalysisWebhookController.name);

  constructor(
    private readonly audioAnalysisService: AudioAnalysisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Webhook endpoint for N8N callbacks (no authentication required for internal webhook)
   * @param data - Webhook payload from N8N containing job results or error information
   * @returns Success response indicating webhook was processed
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async processWebhook(
    @Body() data: any,
    @Headers() headers: Record<string, string>,
  ): Promise<WebhookResponseDto> {
    this.logger.log('=== Webhook Request Started ===');
    this.logger.log(`Headers: ${JSON.stringify(headers)}`);
    this.logger.log(`Raw Data Type: ${typeof data}`);
    this.logger.log(`Raw Data: ${JSON.stringify(data)}`);
    
    try {
      // Webhook endpoint bypasses organization guards as it's an internal N8N callback
      this.logger.log('Getting N8N_WEBHOOK_SECRET from config...');
      let expectedSecret: string | undefined;
      try {
        expectedSecret = this.configService.get<string>('N8N_WEBHOOK_SECRET');
        this.logger.log(`Expected Secret: ${expectedSecret ? '[SET]' : '[NOT_SET]'}`);
      } catch (configError) {
        this.logger.error('Error getting N8N_WEBHOOK_SECRET from config:', configError);
        expectedSecret = undefined;
      }
      
      const receivedSecret =
        headers['x-n8n-webhook-secret'] || headers['X-N8N-WEBHOOK-SECRET'];
      this.logger.log(`Received Secret: ${receivedSecret ? '[RECEIVED]' : '[NOT_RECEIVED]'}`);
      
      if (expectedSecret && receivedSecret !== expectedSecret) {
        this.logger.warn('Secret validation failed');
        throw new BadRequestException('Invalid webhook secret');
      }
      
      this.logger.log('Secret validation passed or skipped');
      
      // Handle array format - take the first element if it's an array
      const webhookData = Array.isArray(data) ? data[0] : data;
      this.logger.log(`Processed webhook data: ${JSON.stringify(webhookData)}`);
      
      if (!webhookData) {
        this.logger.error('Webhook data is null or undefined');
        throw new BadRequestException('Empty webhook payload');
      }
      
      if (!webhookData.jobId) {
        this.logger.error('Missing jobId in webhook data');
        throw new BadRequestException('Missing jobId in webhook payload');
      }
      
      this.logger.log(`Processing webhook for jobId: ${webhookData.jobId}`);
      await this.audioAnalysisService.processWebhookCallback(webhookData);
      
      this.logger.log('Webhook processed successfully');
      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      this.logger.error('=== Webhook Error ===');
      this.logger.error(`Error Type: ${error.constructor.name}`);
      this.logger.error(`Error Message: ${error.message}`);
      this.logger.error(`Error Stack: ${error.stack}`);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        this.logger.warn('Rethrowing known exception');
        throw error;
      }
      
      if (error.message?.includes('not found')) {
        this.logger.warn('Job not found error detected');
        throw new NotFoundException(`Job not found for webhook processing`);
      }
      if (error.message?.includes('validation')) {
        this.logger.warn('Validation error detected');
        throw new BadRequestException(
          `Invalid webhook payload: ${error.message}`,
        );
      }
      
      this.logger.error('Throwing internal server error');
      throw new InternalServerErrorException(
        `Failed to process webhook callback: ${error.message}`,
      );
    }
  }
}
