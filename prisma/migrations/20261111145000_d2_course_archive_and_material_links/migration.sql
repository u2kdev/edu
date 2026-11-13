-- AlterTable
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "courseId" TEXT;
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "fileSizeBytes" INTEGER;
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Material_courseId_idx" ON "Material"("courseId");
CREATE INDEX IF NOT EXISTS "Material_groupId_idx" ON "Material"("groupId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Material_centerId_fkey'
  ) THEN
    ALTER TABLE "Material" ADD CONSTRAINT "Material_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Material_courseId_fkey'
  ) THEN
    ALTER TABLE "Material" ADD CONSTRAINT "Material_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Material_groupId_fkey'
  ) THEN
    ALTER TABLE "Material" ADD CONSTRAINT "Material_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
