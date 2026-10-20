-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED', 'LATE');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('VIDEO', 'LECTURE', 'BOOK', 'TEST', 'LINK');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "GradeType" AS ENUM ('HOMEWORK', 'LESSON', 'TEST', 'ORAL', 'WRITTEN', 'MIDTERM', 'FINAL', 'PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "GradeLifecycle" AS ENUM ('DRAFT', 'SUBMITTED', 'FINAL');

-- CreateEnum
CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- AlterTable (data-preserving: cast existing text values into the new enum type)
ALTER TABLE "Attendance"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "AttendanceStatus" USING ("status"::text::"AttendanceStatus"),
    ALTER COLUMN "status" SET DEFAULT 'PRESENT'::"AttendanceStatus";

ALTER TABLE "EmailOutbox"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "EmailOutboxStatus" USING ("status"::text::"EmailOutboxStatus"),
    ALTER COLUMN "status" SET DEFAULT 'PENDING'::"EmailOutboxStatus";

ALTER TABLE "Grade"
    ALTER COLUMN "gradeType" DROP DEFAULT,
    ALTER COLUMN "gradeType" TYPE "GradeType" USING ("gradeType"::text::"GradeType"),
    ALTER COLUMN "gradeType" SET DEFAULT 'HOMEWORK'::"GradeType",
    ALTER COLUMN "lifecycle" DROP DEFAULT,
    ALTER COLUMN "lifecycle" TYPE "GradeLifecycle" USING ("lifecycle"::text::"GradeLifecycle"),
    ALTER COLUMN "lifecycle" SET DEFAULT 'DRAFT'::"GradeLifecycle";

ALTER TABLE "Material"
    ALTER COLUMN "materialType" DROP DEFAULT,
    ALTER COLUMN "materialType" TYPE "MaterialType" USING ("materialType"::text::"MaterialType"),
    ALTER COLUMN "materialType" SET DEFAULT 'LECTURE'::"MaterialType";

ALTER TABLE "Notification"
    ALTER COLUMN "channel" DROP DEFAULT,
    ALTER COLUMN "channel" TYPE "NotificationChannel" USING ("channel"::text::"NotificationChannel"),
    ALTER COLUMN "channel" SET DEFAULT 'IN_APP'::"NotificationChannel";

ALTER TABLE "TestQuestion"
    ALTER COLUMN "questionType" DROP DEFAULT,
    ALTER COLUMN "questionType" TYPE "QuestionType" USING ("questionType"::text::"QuestionType"),
    ALTER COLUMN "questionType" SET DEFAULT 'SINGLE_CHOICE'::"QuestionType";
