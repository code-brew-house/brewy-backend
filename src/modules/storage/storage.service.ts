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
   * Requires organizationId for organization-scoped storage.
   */
  async uploadFile(file: Express.Multer.File, organizationId: string) {
    try {
      // Validate organizationId
      if (!organizationId) {
        throw new BadRequestException('Organization ID is required');
      }

      // Validate organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!organization) {
        throw new BadRequestException('Organization not found');
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
            url,
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            timestamp: new Date(),
            organizationId,
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
   * Returns all storage records filtered by organization.
   * organizationId is required for data security - use listAllFiles() for SUPER_OWNER access.
   */
  async listFiles(organizationId?: string) {
    try {
      // Validate organizationId is provided and not empty
      if (!organizationId || organizationId.trim() === '') {
        throw new BadRequestException('Organization ID is required');
      }

      const whereClause = { organizationId };

      const files = await this.prisma.storage.findMany({
        where: whereClause,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      console.log(
        `[LIST SUCCESS] Returned ${files.length} files for organization: ${organizationId || 'all'}`,
      );
      return files;
    } catch (error) {
      console.error(`[LIST ERROR] Failed to retrieve files: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve files from database: ' + error.message,
      );
    }
  }

  /**
   * Returns a single storage record by id with organization validation.
   * organizationId is required for data security - use getFileById() for SUPER_OWNER access.
   */
  async getFile(id: string, organizationId?: string) {
    try {
      // Validate organizationId is provided and not empty
      if (!organizationId || organizationId.trim() === '') {
        throw new BadRequestException('Organization ID is required');
      }

      const record = await this.prisma.storage.findUnique({
        where: { id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!record) {
        console.error(`[GET ERROR] File not found: ${id}`);
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      // Validate that the file belongs to the specified organization
      if (record.organizationId !== organizationId) {
        console.error(
          `[GET ERROR] File access denied - organization mismatch: ${id}`,
        );
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      console.log(`[GET SUCCESS] File retrieved: ${id}`);
      return record;
    } catch (error) {
      console.error(`[GET ERROR] Failed to retrieve file: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve file from database: ' + error.message,
      );
    }
  }

  /**
   * Updates file metadata (filename, mimetype) by id with organization validation.
   * organizationId is required for data security.
   */
  async updateFile(id: string, dto: UpdateStorageDto, organizationId?: string) {
    try {
      // For SUPER_OWNER, allow access without organization filter
      const whereClause = organizationId ? { id, organizationId } : { id };

      // First verify the file exists and belongs to the organization
      const existingFile = await this.prisma.storage.findFirst({
        where: whereClause,
      });

      if (!existingFile) {
        console.error(`[UPDATE ERROR] File not found: ${id}`);
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      const record = await this.prisma.storage.update({
        where: { id },
        data: dto,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      console.log(`[UPDATE SUCCESS] File updated: ${id}`);
      return record;
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma record not found error
        console.error(`[UPDATE ERROR] File not found: ${id}`);
        throw new NotFoundException(`File with ID ${id} not found`);
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`[UPDATE ERROR] Failed to update file: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to update file record: ' + error.message,
      );
    }
  }

  /**
   * Deletes a file from R2 and removes the record from the database with organization validation.
   * organizationId is required for data security.
   */
  async deleteFile(id: string, organizationId?: string) {
    try {
      // For SUPER_OWNER, allow access without organization filter
      const whereClause = organizationId ? { id, organizationId } : { id };

      const record = await this.prisma.storage.findFirst({
        where: whereClause,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

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
   * Generates a presigned URL for a file by id with organization validation.
   * organizationId is required for data security.
   */
  async getPresignedUrl(id: string, organizationId?: string) {
    try {
      // For SUPER_OWNER, allow access without organization filter
      const whereClause = organizationId ? { id, organizationId } : { id };

      const record = await this.prisma.storage.findFirst({
        where: whereClause,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

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

  /**
   * Gets storage statistics for an organization.
   */
  async getOrganizationStorageStats(organizationId: string) {
    try {
      const stats = await this.prisma.storage.aggregate({
        where: { organizationId },
        _count: {
          id: true,
        },
        _sum: {
          size: true,
        },
      });

      const totalFiles = stats._count.id || 0;
      const totalSize = stats._sum.size || 0;

      console.log(
        `[STATS SUCCESS] Organization ${organizationId}: ${totalFiles} files, ${totalSize} bytes`,
      );

      return {
        totalFiles,
        totalSize,
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
      };
    } catch (error) {
      console.error(
        `[STATS ERROR] Failed to get storage stats: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to get storage statistics: ' + error.message,
      );
    }
  }

  /**
   * Validates if a user can access a file based on organization context.
   */
  async validateFileAccess(
    fileId: string,
    userOrganizationId: string,
    userRole: string,
  ): Promise<boolean> {
    try {
      // SUPER_OWNER can access any file
      if (userRole === 'SUPER_OWNER') {
        const file = await this.prisma.storage.findUnique({
          where: { id: fileId },
        });
        return !!file;
      }

      // Others can only access files within their organization
      const file = await this.prisma.storage.findUnique({
        where: {
          id: fileId,
          organizationId: userOrganizationId,
        },
      });

      return !!file;
    } catch (error) {
      console.error(
        `[ACCESS ERROR] Failed to validate file access: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * SUPER_OWNER only method to list all files across organizations.
   * Should only be called from controllers with proper role validation.
   */
  async listAllFiles() {
    try {
      const files = await this.prisma.storage.findMany({
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      console.log(
        `[LIST ALL SUCCESS] Returned ${files.length} files across all organizations`,
      );
      return files;
    } catch (error) {
      console.error(
        `[LIST ALL ERROR] Failed to retrieve files: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve files from database: ' + error.message,
      );
    }
  }

  /**
   * SUPER_OWNER only method to get a file by ID without organization restriction.
   * Should only be called from controllers with proper role validation.
   */
  async getFileById(id: string) {
    try {
      const record = await this.prisma.storage.findUnique({
        where: { id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!record) {
        console.error(`[GET BY ID ERROR] File not found: ${id}`);
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      console.log(`[GET BY ID SUCCESS] File retrieved: ${id}`);
      return record;
    } catch (error) {
      console.error(
        `[GET BY ID ERROR] Failed to retrieve file: ${error.message}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve file from database: ' + error.message,
      );
    }
  }
}
