-- CreateTable
CREATE TABLE "ResumeImprovement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "inputHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeImprovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResumeImprovement_applicationId_idx" ON "ResumeImprovement"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeImprovement_userId_inputHash_key" ON "ResumeImprovement"("userId", "inputHash");

-- AddForeignKey
ALTER TABLE "ResumeImprovement" ADD CONSTRAINT "ResumeImprovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeImprovement" ADD CONSTRAINT "ResumeImprovement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
