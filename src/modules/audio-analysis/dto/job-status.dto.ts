import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';

/**
 * DTO for job status response
 */
export class JobStatusDto {
  @IsString()
  id: string;

  @IsEnum(['pending', 'processing', 'completed', 'failed'])
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @IsString()
  fileId: string;

  @IsOptional()
  @IsString()
  error?: string;

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;
}