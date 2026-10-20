-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketScope" AS ENUM ('TENANT', 'PLATFORM');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'WAITLIST', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INVITE', 'NEW_HOMEWORK', 'SCHEDULE_CHANGE', 'SCHEDULE_CANCELLED', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'GRADE_POSTED', 'SUBSCRIPTION_EXPIRING', 'STAFF_ADDED', 'GENERAL', 'ATTENDANCE_ABSENT', 'ATTENDANCE_LATE', 'LESSON_CANCELLED', 'LESSON_SUBSTITUTED', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('LOGIN', 'VIEW_MATERIAL', 'VIEW_VIDEO', 'COMPLETE_TEST', 'SUBMIT_HOMEWORK', 'VIEW_LESSON');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('OFFLINE', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'ONLINE', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "ParentLinkInitiator" AS ENUM ('ADMIN', 'PARENT', 'STUDENT');

-- AlterTable (data-preserving: cast existing text values into the new enum type)
ALTER TABLE "SupportTicket"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "TicketStatus" USING ("status"::text::"TicketStatus"),
    ALTER COLUMN "status" SET DEFAULT 'OPEN'::"TicketStatus",
    ALTER COLUMN "priority" DROP DEFAULT,
    ALTER COLUMN "priority" TYPE "TicketPriority" USING ("priority"::text::"TicketPriority"),
    ALTER COLUMN "priority" SET DEFAULT 'MEDIUM'::"TicketPriority",
    ALTER COLUMN "scope" DROP DEFAULT,
    ALTER COLUMN "scope" TYPE "TicketScope" USING ("scope"::text::"TicketScope"),
    ALTER COLUMN "scope" SET DEFAULT 'TENANT'::"TicketScope";

ALTER TABLE "Enrollment"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "EnrollmentStatus" USING ("status"::text::"EnrollmentStatus"),
    ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"EnrollmentStatus";

ALTER TABLE "Notification"
    ALTER COLUMN "type" DROP DEFAULT,
    ALTER COLUMN "type" TYPE "NotificationType" USING ("type"::text::"NotificationType"),
    ALTER COLUMN "type" SET DEFAULT 'GENERAL'::"NotificationType";

ALTER TABLE "ActivityLog"
    ALTER COLUMN "activityType" TYPE "ActivityType" USING ("activityType"::text::"ActivityType");

ALTER TABLE "Lesson"
    ALTER COLUMN "lessonType" DROP DEFAULT,
    ALTER COLUMN "lessonType" TYPE "LessonType" USING ("lessonType"::text::"LessonType"),
    ALTER COLUMN "lessonType" SET DEFAULT 'OFFLINE'::"LessonType";

ALTER TABLE "CenterPayment"
    ALTER COLUMN "paymentMethod" DROP DEFAULT,
    ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING ("paymentMethod"::text::"PaymentMethod"),
    ALTER COLUMN "paymentMethod" SET DEFAULT 'CASH'::"PaymentMethod";

ALTER TABLE "ParentLink"
    ALTER COLUMN "initiatedBy" DROP DEFAULT,
    ALTER COLUMN "initiatedBy" TYPE "ParentLinkInitiator" USING ("initiatedBy"::text::"ParentLinkInitiator"),
    ALTER COLUMN "initiatedBy" SET DEFAULT 'ADMIN'::"ParentLinkInitiator";

ALTER TABLE "Announcement"
    ALTER COLUMN "targetRole" TYPE "MembershipRole" USING ("targetRole"::text::"MembershipRole");
