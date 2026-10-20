-- CreateEnum
CREATE TYPE "CenterType" AS ENUM ('OFFLINE', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "GradingScale" AS ENUM ('PERCENT_100', 'POINTS_5', 'PASS_FAIL');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('UZS', 'USD', 'EUR', 'RUB');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'DEVELOPER', 'SUPERADMIN', 'PLATFORM_ADMIN', 'FULL_ACCESS', 'PLATFORM_SUPPORT', 'SEO_ADMIN');

-- AlterTable (data-preserving: cast existing text values into the new enum type)
ALTER TABLE "LearningCenter"
    ALTER COLUMN "centerType" DROP DEFAULT,
    ALTER COLUMN "centerType" TYPE "CenterType" USING ("centerType"::text::"CenterType"),
    ALTER COLUMN "centerType" SET DEFAULT 'HYBRID'::"CenterType",
    ALTER COLUMN "gradingScale" DROP DEFAULT,
    ALTER COLUMN "gradingScale" TYPE "GradingScale" USING ("gradingScale"::text::"GradingScale"),
    ALTER COLUMN "gradingScale" SET DEFAULT 'PERCENT_100'::"GradingScale";

ALTER TABLE "CenterPayment"
    ALTER COLUMN "currency" DROP DEFAULT,
    ALTER COLUMN "currency" TYPE "Currency" USING ("currency"::text::"Currency"),
    ALTER COLUMN "currency" SET DEFAULT 'UZS'::"Currency";

ALTER TABLE "PlatformUser"
    ALTER COLUMN "platformRole" DROP DEFAULT,
    ALTER COLUMN "platformRole" TYPE "PlatformRole" USING ("platformRole"::text::"PlatformRole"),
    ALTER COLUMN "platformRole" SET DEFAULT 'NONE'::"PlatformRole";
