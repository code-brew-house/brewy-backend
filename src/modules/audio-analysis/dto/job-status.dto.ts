import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for file information in job status response
 */
export class FileInfoDto {
  @IsString()
  id: string;

  @IsString()
  filename: string;

  @IsString()
  size: number;

  @IsString()
  mimetype: string;
}

/**
 * DTO for job status response
 */
export class JobStatusDto {
  @IsString()
  id: string;

  @IsEnum(['pending', 'processing', 'completed', 'failed'])
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;

  @IsOptional()
  @IsDateString()
  startedAt?: Date | null;

  @IsOptional()
  @IsDateString()
  completedAt?: Date | null;

  @IsOptional()
  @IsString()
  error?: string | null;

  @IsObject()
  @Type(() => FileInfoDto)
  file: FileInfoDto;
}
