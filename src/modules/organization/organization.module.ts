import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { OrganizationCleanupJob } from './jobs/organization-cleanup.job';
import { PrismaService } from '../../prisma/prisma.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationCleanupJob, PrismaService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
