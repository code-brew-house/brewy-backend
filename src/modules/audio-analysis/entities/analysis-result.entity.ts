import { IsString, IsOptional, IsObject, IsDateString, IsUUID } from 'class-validator';

/**
 * AnalysisResult entity represents the results of audio analysis from Assembly AI.
 * Stores transcript, sentiment, and additional metadata for completed jobs.
 */
export class AnalysisResult {
  /**
   * Unique identifier for the analysis result
   */
  @IsUUID()
  id: string;

  /**
   * Reference to the job that produced this result
   */
  @IsUUID()
  jobId: string;

  /**
   * Transcript text from the audio analysis
   */
  @IsString()
  transcript: string;

  /**
   * Sentiment analysis result (string or JSON format)
   */
  @IsOptional()
  @IsString()
  sentiment: string | null;

  /**
   * Additional metadata from Assembly AI analysis (nullable)
   */
  @IsOptional()
  @IsObject()
  metadata: Record<string, any> | null;

  /**
   * Timestamp when the result was created
   */
  @IsDateString()
  createdAt: Date;
}