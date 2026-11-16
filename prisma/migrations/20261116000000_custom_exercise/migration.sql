-- DropIndex
DROP INDEX "Exercise_name_key";

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Exercise_createdByUserId_isActive_idx" ON "Exercise"("createdByUserId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_createdByUserId_name_key" ON "Exercise"("createdByUserId", "name");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

