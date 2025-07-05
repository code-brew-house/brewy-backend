import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

/**
 * DTO for audio file upload with validation
 */
export class UploadAudioDto {
  @IsNotEmpty()
  @IsString()
  filename: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}