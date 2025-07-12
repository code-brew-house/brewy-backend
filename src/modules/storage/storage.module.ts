import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { R2StorageService } from './r2-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

/**
 * StorageModule provides file storage services with organization-scoped access control.
 * Exposes REST endpoints with role-based permissions and organization context validation.
 */
@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [StorageService, R2StorageService, PrismaService],
  exports: [StorageService],
})
export class StorageModule {}
