import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for audio file upload with validation
 */
export class UploadAudioDto {
  /**
   * Audio file to upload (MP3 format, max 20MB)
   * File validation is handled by AudioAnalysisService
   */
  @IsNotEmpty({ message: 'Audio file is required' })
  @IsObject()
  file: Express.Multer.File;

  /**
   * Optional metadata for the audio file
   */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toString())
  metadata?: string;
}
