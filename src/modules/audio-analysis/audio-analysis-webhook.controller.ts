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
    // Webhook endpoint bypasses organization guards as it's an internal N8N callback
    const expectedSecret = this.configService.get<string>('N8N_WEBHOOK_SECRET');
    const receivedSecret =
      headers['x-n8n-webhook-secret'] || headers['X-N8N-WEBHOOK-SECRET'];
    if (expectedSecret && receivedSecret !== expectedSecret) {
      throw new BadRequestException('Invalid webhook secret');
    }
    try {
      // Handle array format - take the first element if it's an array
      const webhookData = Array.isArray(data) ? data[0] : data;
      await this.audioAnalysisService.processWebhookCallback(webhookData);
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
