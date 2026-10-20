-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ru', 'uz-Latn', 'uz-Cyrl');

-- AlterTable (data-preserving: cast existing text values into the new enum type)
ALTER TABLE "PlatformUser"
    ALTER COLUMN "preferredLanguage" DROP DEFAULT,
    ALTER COLUMN "preferredLanguage" TYPE "Language" USING ("preferredLanguage"::text::"Language"),
    ALTER COLUMN "preferredLanguage" SET DEFAULT 'ru'::"Language";

ALTER TABLE "LearningCenter"
    ALTER COLUMN "defaultLanguage" DROP DEFAULT,
    ALTER COLUMN "defaultLanguage" TYPE "Language" USING ("defaultLanguage"::text::"Language"),
    ALTER COLUMN "defaultLanguage" SET DEFAULT 'ru'::"Language";
