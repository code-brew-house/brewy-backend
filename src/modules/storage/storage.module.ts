import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { R2StorageService } from './r2-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from './storage.service';

/**
 * StorageModule provides file storage services for other modules.
 * No longer exposes REST endpoints - those are handled by AudioAnalysisModule.
 */
@Module({
  imports: [ConfigModule],
  providers: [StorageService, R2StorageService, PrismaService],
  exports: [StorageService],
})
export class StorageModule {}
