-- AlterTable
ALTER TABLE "GapAnalysis" ADD COLUMN     "applicationId" TEXT;

-- CreateIndex
CREATE INDEX "GapAnalysis_applicationId_idx" ON "GapAnalysis"("applicationId");

-- AddForeignKey
ALTER TABLE "GapAnalysis" ADD CONSTRAINT "GapAnalysis_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
