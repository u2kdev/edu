-- CreateEnum
CREATE TYPE "CenterStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAUSED', 'OVERDUE', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'FROZEN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('DIRECTOR', 'CENTER_ADMIN', 'TEACHER', 'TEACHER_ASSISTANT', 'CENTER_SUPPORT', 'STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ParentLinkStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PendingInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "ScheduleSlotStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CenterPaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_PAID', 'FAILED', 'REFUNDED');

-- AlterTable (data-preserving: cast existing text values into the new enum type)
ALTER TABLE "LearningCenter"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "CenterStatus" USING ("status"::text::"CenterStatus"),
    ALTER COLUMN "status" SET DEFAULT 'TRIAL'::"CenterStatus";

ALTER TABLE "Subscription"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "SubscriptionStatus" USING ("status"::text::"SubscriptionStatus"),
    ALTER COLUMN "status" SET DEFAULT 'TRIAL'::"SubscriptionStatus";

ALTER TABLE "CenterMembership"
    ALTER COLUMN "role" TYPE "MembershipRole" USING ("role"::text::"MembershipRole"),
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "MembershipStatus" USING ("status"::text::"MembershipStatus"),
    ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"MembershipStatus";

ALTER TABLE "ParentLink"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "ParentLinkStatus" USING ("status"::text::"ParentLinkStatus"),
    ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ParentLinkStatus";

ALTER TABLE "PendingInvite"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "PendingInviteStatus" USING ("status"::text::"PendingInviteStatus"),
    ALTER COLUMN "status" SET DEFAULT 'PENDING'::"PendingInviteStatus";

ALTER TABLE "Lesson"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "LessonStatus" USING ("status"::text::"LessonStatus"),
    ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"LessonStatus";

ALTER TABLE "ScheduleSlot"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "ScheduleSlotStatus" USING ("status"::text::"ScheduleSlotStatus"),
    ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"ScheduleSlotStatus";

ALTER TABLE "HomeworkSubmission"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "SubmissionStatus" USING ("status"::text::"SubmissionStatus"),
    ALTER COLUMN "status" SET DEFAULT 'NOT_SUBMITTED'::"SubmissionStatus";

ALTER TABLE "CenterPayment"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "CenterPaymentStatus" USING ("status"::text::"CenterPaymentStatus"),
    ALTER COLUMN "status" SET DEFAULT 'PENDING'::"CenterPaymentStatus";
