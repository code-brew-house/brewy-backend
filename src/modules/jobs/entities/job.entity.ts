import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsUUID,
} from 'class-validator';

/**
 * Job entity represents an audio analysis job in the system.
 * Tracks the status and metadata of audio processing workflows.
 */
export class Job {
  /**
   * Unique identifier for the job
   */
  @IsUUID()
  id: string;

  /**
   * Current status of the job (pending, processing, completed, failed)
   */
  @IsEnum(['pending', 'processing', 'completed', 'failed'])
  status: 'pending' | 'processing' | 'completed' | 'failed';

  /**
   * Reference to the uploaded file in storage
   */
  @IsUUID()
  fileId: string;

  /**
   * Timestamp when the job was created
   */
  @IsDateString()
  createdAt: Date;

  /**
   * Timestamp when the job was last updated
   */
  @IsDateString()
  updatedAt: Date;

  /**
   * Timestamp when the job processing started (nullable)
   */
  @IsOptional()
  @IsDateString()
  startedAt: Date | null;

  /**
   * Timestamp when the job was completed (nullable)
   */
  @IsOptional()
  @IsDateString()
  completedAt: Date | null;

  /**
   * Error message if the job failed (nullable)
   */
  @IsOptional()
  @IsString()
  error: string | null;
}
