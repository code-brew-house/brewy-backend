import { IsString, IsOptional } from 'class-validator';

/**
 * DTO for outgoing webhook payload to N8N
 */
export interface N8NWebhookPayloadDto {
  jobId: string;
  fileUrl: string;
  timestamp: string;
}

/**
 * DTO for incoming webhook callback from N8N
 */
export class N8NWebhookCallbackDto {
  jobId: string;
  status: 'completed' | 'failed';
  transcript?: string;
  sentiment?: string;
  metadata?: any;
  error?: string;
}

/**
 * DTO for webhook response
 */
export class WebhookResponseDto {
  success: boolean;

  @IsOptional()
  @IsString()
  message?: string;
}
