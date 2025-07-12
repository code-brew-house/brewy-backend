import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * OrganizationCleanupJob handles permanent deletion of archived organizations
 * after a specified retention period.
 */
@Injectable()
export class OrganizationCleanupJob {
  private readonly logger = new Logger(OrganizationCleanupJob.name);
  private readonly RETENTION_PERIOD_DAYS = 90; // 90 days retention period

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scheduled job that runs daily at 2 AM to clean up archived organizations
   * that have exceeded the retention period.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupArchivedOrganizations(): Promise<void> {
    this.logger.log('Starting organization cleanup job');

    try {
      // Calculate cutoff date (current date - retention period)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_PERIOD_DAYS);

      // Find organizations that were archived before the cutoff date
      const organizationsToDelete = await this.prisma.organization.findMany({
        where: {
          archivedAt: {
            not: null,
            lte: cutoffDate,
          },
        },
        select: {
          id: true,
          name: true,
          archivedAt: true,
        },
      });

      if (organizationsToDelete.length === 0) {
        this.logger.log('No archived organizations found for cleanup');
        return;
      }

      this.logger.log(
        `Found ${organizationsToDelete.length} organizations for permanent deletion`,
      );

      // Process each organization for permanent deletion
      for (const org of organizationsToDelete) {
        try {
          await this.permanentlyDeleteOrganization(org.id, org.name);
        } catch (error) {
          this.logger.error(
            `Failed to delete organization ${org.id} (${org.name}): ${error.message}`,
          );
          // Continue with other organizations even if one fails
        }
      }

      this.logger.log('Organization cleanup job completed successfully');
    } catch (error) {
      this.logger.error(
        `Organization cleanup job failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Permanently deletes an organization and all its related data.
   * This operation is irreversible.
   */
  private async permanentlyDeleteOrganization(
    organizationId: string,
    organizationName: string,
  ): Promise<void> {
    this.logger.log(
      `Starting permanent deletion of organization: ${organizationId} (${organizationName})`,
    );

    try {
      // Use a transaction to ensure all deletions succeed or fail together
      await this.prisma.$transaction(async (tx) => {
        // Delete analysis results first (due to foreign key constraints)
        const deletedResults = await tx.analysisResult.deleteMany({
          where: { organizationId },
        });
        this.logger.debug(
          `Deleted ${deletedResults.count} analysis results for organization ${organizationId}`,
        );

        // Delete jobs
        const deletedJobs = await tx.job.deleteMany({
          where: { organizationId },
        });
        this.logger.debug(
          `Deleted ${deletedJobs.count} jobs for organization ${organizationId}`,
        );

        // Delete storage records
        const deletedStorage = await tx.storage.deleteMany({
          where: { organizationId },
        });
        this.logger.debug(
          `Deleted ${deletedStorage.count} storage records for organization ${organizationId}`,
        );

        // Delete users
        const deletedUsers = await tx.user.deleteMany({
          where: { organizationId },
        });
        this.logger.debug(
          `Deleted ${deletedUsers.count} users for organization ${organizationId}`,
        );

        // Finally, delete the organization itself
        await tx.organization.delete({
          where: { id: organizationId },
        });
        this.logger.debug(
          `Deleted organization ${organizationId} (${organizationName})`,
        );
      });

      this.logger.log(
        `Successfully completed permanent deletion of organization: ${organizationId} (${organizationName})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to permanently delete organization ${organizationId} (${organizationName}): ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Manual cleanup method for testing or administrative purposes.
   * Allows for immediate cleanup without waiting for the scheduled job.
   */
  async runManualCleanup(): Promise<{
    processed: number;
    deleted: number;
    errors: number;
  }> {
    this.logger.log('Starting manual organization cleanup');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_PERIOD_DAYS);

    const organizationsToDelete = await this.prisma.organization.findMany({
      where: {
        archivedAt: {
          not: null,
          lte: cutoffDate,
        },
      },
      select: {
        id: true,
        name: true,
        archivedAt: true,
      },
    });

    let deleted = 0;
    let errors = 0;

    for (const org of organizationsToDelete) {
      try {
        await this.permanentlyDeleteOrganization(org.id, org.name);
        deleted++;
      } catch (error) {
        errors++;
        this.logger.error(
          `Manual cleanup failed for organization ${org.id}: ${error.message}`,
        );
      }
    }

    const result = {
      processed: organizationsToDelete.length,
      deleted,
      errors,
    };

    this.logger.log(`Manual cleanup completed: ${JSON.stringify(result)}`);

    return result;
  }
}
