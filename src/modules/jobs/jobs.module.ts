import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * JobsModule handles job management operations for various processing workflows.
 * Provides CRUD operations and status tracking for all types of jobs in the system.
 */
@Module({
  providers: [JobsService, PrismaService],
  exports: [JobsService],
})
export class JobsModule {}
