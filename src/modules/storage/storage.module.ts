import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { R2StorageService } from './r2-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

/**
 * StorageModule encapsulates file storage logic and API endpoints.
 */
@Module({
  imports: [ConfigModule],
  providers: [StorageService, R2StorageService, PrismaService],
  controllers: [StorageController],
  exports: [StorageService],
})
export class StorageModule {}
