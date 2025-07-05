import { IsString, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

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
  @IsString()
  jobId: string;

  @IsEnum(['completed', 'failed'])
  status: 'completed' | 'failed';

  @IsOptional()
  @IsString()
  transcript?: string;

  @IsOptional()
  @IsString()
  sentiment?: string;

  @IsOptional()
  @Transform(({ value }) => value || null)
  metadata?: any;

  @IsOptional()
  @IsString()
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
