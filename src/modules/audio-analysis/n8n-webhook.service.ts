import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { N8NWebhookPayloadDto } from './dto/webhook.dto';

/**
 * N8NWebhookService handles outbound HTTP calls to the N8N webhook endpoint.
 */
@Injectable()
export class N8NWebhookService {
  private readonly logger = new Logger(N8NWebhookService.name);
  private readonly webhookUrl: string;
  private readonly webhookSecret: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL', '');
    this.webhookSecret = this.configService.get<string>('N8N_WEBHOOK_SECRET');
  }

  /**
   * Triggers the N8N webhook with the given payload.
   * @param payload The data to send to N8N
   * @returns The response data from N8N, including transcriptId if available
   */
  async triggerWebhook(payload: N8NWebhookPayloadDto): Promise<any> {
    if (!this.webhookUrl) {
      this.logger.warn(
        'N8N_WEBHOOK_URL not configured, skipping webhook trigger',
      );
      return null;
    }
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.webhookSecret) {
        headers['x-n8n-webhook-secret'] = this.webhookSecret;
      }
      const response = await axios.post(this.webhookUrl, payload, {
        headers,
        timeout: 10000,
      });
      if (response.status >= 200 && response.status < 300) {
        this.logger.log('N8N webhook triggered successfully');
        this.logger.log(
          `N8N webhook response data: ${JSON.stringify(response.data)}`,
        );
        return response.data;
      } else {
        this.logger.error(
          'N8N webhook non-2xx response',
          response.status,
          response.data,
        );
        throw new Error(
          `N8N webhook returned status ${response.status}: ${JSON.stringify(response.data)}`,
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(
          'N8N webhook error response',
          error.response.status,
          error.response.data,
        );
        throw new Error(
          `N8N webhook error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
        );
      }
      this.logger.error('Failed to trigger N8N webhook:', error as Error);
      throw error;
    }
  }
}
