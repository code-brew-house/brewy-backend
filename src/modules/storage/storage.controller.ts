import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Body,
  Delete,
  HttpCode,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { UpdateStorageDto } from './dto/update-storage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Organization } from '../../common/decorators/organization.decorator';
import { RequestUser } from '../../common/types/request.types';

/**
 * StorageController handles HTTP endpoints for file storage operations
 * with organization-scoped access control and role-based permissions.
 */
@Controller('storage')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Upload a file to organization storage
   * @param file - File to upload (MP3, max 50MB)
   * @param organizationId - Organization ID from authenticated user
   * @returns Uploaded file record
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN', 'AGENT')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
      fileFilter: (_, file, callback) => {
        // Allow MP3 files based on mimetype and extension
        const allowedMimeTypes = [
          'audio/mpeg',
          'audio/mp3',
          'audio/mpeg3',
          'audio/x-mpeg-3',
          'application/octet-stream',
        ];

        const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
        const hasMP3Extension = file.originalname
          ?.toLowerCase()
          .endsWith('.mp3');

        if (isValidMimeType || hasMP3Extension) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Only MP3 files are allowed'),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Organization() organizationId: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    try {
      return await this.storageService.uploadFile(file, organizationId);
    } catch (error) {
      if (error.message?.includes('File size')) {
        throw new BadRequestException('File size exceeds 50MB limit');
      }
      if (error.message?.includes('Only MP3 files')) {
        throw new BadRequestException('Only MP3 files are allowed');
      }
      throw error;
    }
  }

  /**
   * List all files in the organization
   * SUPER_OWNER can optionally specify organizationId to view other organization files
   * @param user - Current authenticated user
   * @param organizationId - Organization ID from authenticated user
   * @returns List of files with organization details
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_OWNER', 'OWNER', 'ADMIN', 'AGENT')
  async listFiles(
    @CurrentUser() user: RequestUser,
    @Organization() organizationId: string,
  ) {
    // SUPER_OWNER can see all files if no specific organization context
    const filterOrgId =
      user.role === 'SUPER_OWNER' ? undefined : organizationId;
    return await this.storageService.listFiles(filterOrgId);
  }

  /**
   * Get a specific file by ID
   * @param id - File ID
   * @param user - Current authenticated user
   * @param organizationId - Organization ID from authenticated user
   * @returns File record with organization details
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_OWNER', 'OWNER', 'ADMIN', 'AGENT')
  async getFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Organization() organizationId: string,
  ) {
    // Validate file access
    const hasAccess = await this.storageService.validateFileAccess(
      id,
      organizationId,
      user.role,
    );

    if (!hasAccess) {
      throw new NotFoundException('File not found');
    }

    const filterOrgId =
      user.role === 'SUPER_OWNER' ? undefined : organizationId;
    return await this.storageService.getFile(id, filterOrgId);
  }

  /**
   * Update file metadata
   * @param id - File ID
   * @param updateDto - Update data
   * @param user - Current authenticated user
   * @param organizationId - Organization ID from authenticated user
   * @returns Updated file record
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_OWNER', 'OWNER', 'ADMIN')
  async updateFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateStorageDto,
    @CurrentUser() user: RequestUser,
    @Organization() organizationId: string,
  ) {
    // Validate file access
    const hasAccess = await this.storageService.validateFileAccess(
      id,
      organizationId,
      user.role,
    );

    if (!hasAccess) {
      throw new NotFoundException('File not found');
    }

    const filterOrgId =
      user.role === 'SUPER_OWNER' ? undefined : organizationId;
    return await this.storageService.updateFile(id, updateDto, filterOrgId);
  }

  /**
   * Delete a file
   * @param id - File ID
   * @param user - Current authenticated user
   * @param organizationId - Organization ID from authenticated user
   * @returns Success response
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_OWNER', 'OWNER', 'ADMIN')
  async deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Organization() organizationId: string,
  ) {
    // Validate file access
    const hasAccess = await this.storageService.validateFileAccess(
      id,
      organizationId,
      user.role,
    );

    if (!hasAccess) {
      throw new NotFoundException('File not found');
    }

    const filterOrgId =
      user.role === 'SUPER_OWNER' ? undefined : organizationId;
    return await this.storageService.deleteFile(id, filterOrgId);
  }

  /**
   * Get presigned URL for file access
   * @param id - File ID
   * @param user - Current authenticated user
   * @param organizationId - Organization ID from authenticated user
   * @returns Presigned URL for file access
   */
  @Get(':id/presigned-url')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_OWNER', 'OWNER', 'ADMIN', 'AGENT')
  async getPresignedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Organization() organizationId: string,
  ) {
    // Validate file access
    const hasAccess = await this.storageService.validateFileAccess(
      id,
      organizationId,
      user.role,
    );

    if (!hasAccess) {
      throw new NotFoundException('File not found');
    }

    const filterOrgId =
      user.role === 'SUPER_OWNER' ? undefined : organizationId;
    return await this.storageService.getPresignedUrl(id, filterOrgId);
  }

  /**
   * Get storage statistics for the organization
   * @param organizationId - Organization ID from authenticated user
   * @returns Storage usage statistics
   */
  @Get('stats/usage')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_OWNER', 'OWNER', 'ADMIN')
  async getStorageStats(@Organization() organizationId: string) {
    return await this.storageService.getOrganizationStorageStats(
      organizationId,
    );
  }
}
