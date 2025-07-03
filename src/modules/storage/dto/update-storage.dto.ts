import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for updating file metadata in storage.
 */
export class UpdateStorageDto {
  /** New filename (optional) */
  @IsOptional()
  @IsString()
  filename?: string;

  /** New mimetype (optional) */
  @IsOptional()
  @IsString()
  mimetype?: string;
}
