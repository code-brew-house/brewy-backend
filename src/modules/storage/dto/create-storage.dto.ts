import { IsString, IsInt } from 'class-validator';

/**
 * DTO for uploading a file to storage.
 */
export class CreateStorageDto {
  /** Original filename of the uploaded file */
  @IsString()
  filename: string;

  /** MIME type of the file */
  @IsString()
  mimetype: string;

  /** Size of the file in bytes */
  @IsInt()
  size: number;
}
