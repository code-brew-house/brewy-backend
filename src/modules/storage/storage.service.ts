import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { R2StorageService } from './r2-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateStorageDto } from './dto/update-storage.dto';
import { Readable } from 'stream';

/**
 * StorageService handles business logic for file storage CRUD and integration.
 */
@Injectable()
export class StorageService {
  constructor(
    private readonly r2: R2StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Uploads a file to R2 and saves the record in the database.
   * Streams the file to R2 to avoid memory issues.
   */
  async uploadFile(file: Express.Multer.File) {
    try {
      // Validate file type (MP3 only)
      const allowedMimeTypes = [
        'audio/mpeg',
        'audio/mp3',
        'audio/mpeg3',
        'audio/x-mpeg-3',
        'application/octet-stream',
      ];

      const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
      const hasMP3Extension = file.originalname?.toLowerCase().endsWith('.mp3');

      if (!isValidMimeType && !hasMP3Extension) {
        console.error(`[UPLOAD ERROR] Invalid file type: ${file.mimetype}`);
        throw new BadRequestException('Only MP3 files are allowed');
      }

      // Validate file size (50MB max)
      const maxSize = 50 * 1024 * 1024; // 50MB in bytes
      if (file.size > maxSize) {
        console.error(`[UPLOAD ERROR] File too large: ${file.size} bytes`);
        throw new BadRequestException('File size must be 50MB or less');
      }

      const key = `${Date.now()}-${file.originalname}`;

      // Upload to R2 with streaming
      let url: string;
      try {
        // Handle both real requests (with stream) and test scenarios (with buffer)
        const fileStream = file.stream || Readable.from(file.buffer);
        url = await this.r2.uploadFile(key, fileStream, file.mimetype);
        console.log(`[UPLOAD SUCCESS] File uploaded to R2: ${key}`);
      } catch (error) {
        console.error(
          `[UPLOAD ERROR] Failed to upload to R2: ${error.message}`,
        );
        throw new InternalServerErrorException(
          'Failed to upload file to storage: ' + error.message,
        );
      }

      // Save to database with error handling
      try {
        const record = await this.prisma.storage.create({
          data: {
            id: undefined,
            url,
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            timestamp: new Date(),
          },
        });
        console.log(`[DB SUCCESS] File record created: ${record.id}`);
        return record;
      } catch (error) {
        // If DB save fails, try to clean up R2 file
        try {
          await this.r2.deleteFile(key);
        } catch (cleanupError) {
          console.error(
            `[CLEANUP ERROR] Failed to delete R2 file after DB error: ${cleanupError.message}`,
          );
        }
        console.error(
          `[DB ERROR] Failed to save file record: ${error.message}`,
        );
        throw new InternalServerErrorException(
          'Failed to save file record to database: ' + error.message,
        );
      }
    } catch (error) {
      console.error(`[UPLOAD ERROR] Unexpected: ${error.message}`);
      // Re-throw known exceptions, wrap unknown ones
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Unexpected error during file upload: ' + error.message,
      );
    }
  }

  /**
   * Returns all storage records.
   */
  async listFiles() {
    try {
      const files = await this.prisma.storage.findMany();
      console.log(`[LIST SUCCESS] Returned ${files.length} files`);
      return files;
    } catch (error) {
      console.error(`[LIST ERROR] Failed to retrieve files: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to retrieve files from database: ' + error.message,
      );
    }
  }

  /**
   * Returns a single storage record by id.
   */
  async getFile(id: string) {
    try {
      const record = await this.prisma.storage.findUnique({ where: { id } });
      if (!record) {
        console.error(`[GET ERROR] File not found: ${id}`);
        throw new NotFoundException(`File with ID ${id} not found`);
      }
      console.log(`[GET SUCCESS] File retrieved: ${id}`);
      return record;
    } catch (error) {
      console.error(`[GET ERROR] Failed to retrieve file: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve file from database: ' + error.message,
      );
    }
  }

  /**
   * Updates file metadata (filename, mimetype) by id.
   */
  async updateFile(id: string, dto: UpdateStorageDto) {
    try {
      const record = await this.prisma.storage.update({
        where: { id },
        data: dto,
      });
      console.log(`[UPDATE SUCCESS] File updated: ${id}`);
      return record;
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma record not found error
        console.error(`[UPDATE ERROR] File not found: ${id}`);
        throw new NotFoundException(`File with ID ${id} not found`);
      }
      console.error(`[UPDATE ERROR] Failed to update file: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to update file record: ' + error.message,
      );
    }
  }

  /**
   * Deletes a file from R2 and removes the record from the database.
   */
  async deleteFile(id: string) {
    try {
      const record = await this.prisma.storage.findUnique({ where: { id } });
      if (!record) {
        console.error(`[DELETE ERROR] File not found: ${id}`);
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      // Extract the key from the URL
      const key = record.url.split('/').pop();

      // Delete from R2 first
      if (key) {
        try {
          await this.r2.deleteFile(key);
          console.log(`[DELETE SUCCESS] File deleted from R2: ${key}`);
        } catch (error) {
          console.error(
            `[DELETE ERROR] Failed to delete from R2: ${error.message}`,
          );
          throw new InternalServerErrorException(
            'Failed to delete file from storage: ' + error.message,
          );
        }
      }

      // Delete from database
      try {
        await this.prisma.storage.delete({ where: { id } });
        console.log(`[DELETE SUCCESS] File record deleted: ${id}`);
      } catch (error) {
        console.error(
          `[DELETE ERROR] Failed to delete DB record: ${error.message}`,
        );
        throw new InternalServerErrorException(
          'Failed to delete file record from database: ' + error.message,
        );
      }

      return { success: true, id };
    } catch (error) {
      console.error(`[DELETE ERROR] Unexpected: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Unexpected error during file deletion: ' + error.message,
      );
    }
  }

  /**
   * Generates a presigned URL for a file by id.
   */
  async getPresignedUrl(id: string) {
    try {
      const record = await this.prisma.storage.findUnique({ where: { id } });
      if (!record) {
        console.error(`[PRESIGNED ERROR] File not found: ${id}`);
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      const key = record.url.split('/').pop();
      if (!key) {
        console.error(`[PRESIGNED ERROR] Invalid file key for: ${id}`);
        throw new InternalServerErrorException(
          'Invalid file key extracted from URL',
        );
      }

      try {
        const presignedUrl = await this.r2.getPresignedUrl(key);
        console.log(`[PRESIGNED SUCCESS] URL generated for: ${id}`);
        return { url: presignedUrl };
      } catch (error) {
        console.error(
          `[PRESIGNED ERROR] Failed to generate URL: ${error.message}`,
        );
        throw new InternalServerErrorException(
          'Failed to generate presigned URL: ' + error.message,
        );
      }
    } catch (error) {
      console.error(`[PRESIGNED ERROR] Unexpected: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Unexpected error generating presigned URL: ' + error.message,
      );
    }
  }
}
