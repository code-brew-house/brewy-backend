-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "externalReferenceId" TEXT;

-- CreateIndex
CREATE INDEX "Job_externalReferenceId_idx" ON "Job"("externalReferenceId");
