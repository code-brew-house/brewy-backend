import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Get,
  Param,
  Patch,
  Body,
  Delete,
  BadRequestException,
  UseFilters,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { UpdateStorageDto } from './dto/update-storage.dto';
import { HttpExceptionFilter } from '../../filters/http-exception.filter';

/**
 * StorageController exposes REST API endpoints for file storage operations.
 */
@Controller('storage')
@UseFilters(HttpExceptionFilter)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (file.size === 0) {
      throw new BadRequestException('File is empty');
    }

    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mpeg3',
      'audio/x-mpeg-3',
      'application/octet-stream',
    ];

    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
    const hasMP3Extension = file.originalname?.toLowerCase().endsWith('.mp3');
    console.log(file.mimetype, file.originalname);
    if (!isValidMimeType && !hasMP3Extension) {
      throw new BadRequestException('Only MP3 files are allowed');
    }

    if (file.size > 50 * 1024 * 1024) {
      // 50MB
      throw new BadRequestException('File size must be 50MB or less');
    }
    return this.storageService.uploadFile(file);
  }

  @Get()
  async listFiles() {
    return this.storageService.listFiles();
  }

  @Get(':id')
  async getFile(@Param('id') id: string) {
    return this.storageService.getFile(id);
  }

  @Patch(':id')
  async updateFile(@Param('id') id: string, @Body() dto: UpdateStorageDto) {
    return this.storageService.updateFile(id, dto);
  }

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    return this.storageService.deleteFile(id);
  }

  @Get(':id/presigned-url')
  async getPresignedUrl(@Param('id') id: string) {
    return this.storageService.getPresignedUrl(id);
  }
}
