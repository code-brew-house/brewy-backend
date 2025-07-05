import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsObject,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for job file information in analysis results response
 */
export class AnalysisJobFileDto {
  @IsString()
  filename: string;

  @IsNumber()
  size: number;
}

/**
 * DTO for job information in analysis results response
 */
export class AnalysisJobDto {
  @IsString()
  id: string;

  @IsEnum(['pending', 'processing', 'completed', 'failed'])
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @IsObject()
  @Type(() => AnalysisJobFileDto)
  file: AnalysisJobFileDto;
}

/**
 * DTO for analysis results response
 */
export class AnalysisResultsDto {
  @IsString()
  id: string;

  @IsString()
  jobId: string;

  @IsString()
  transcript: string;

  @IsString()
  sentiment: string;

  @IsOptional()
  metadata?: any;

  @IsDateString()
  createdAt: Date;

  @IsObject()
  @Type(() => AnalysisJobDto)
  job: AnalysisJobDto;
}
