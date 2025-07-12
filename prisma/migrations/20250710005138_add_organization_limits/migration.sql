-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "maxConcurrentJobs" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "maxUsers" INTEGER NOT NULL DEFAULT 10;
