-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN "emailConfirmExpires" DATETIME;
ALTER TABLE "PlatformUser" ADD COLUMN "emailConfirmToken" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN "emailVerified" DATETIME;

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockoutUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_email_ip_key" ON "LoginAttempt"("email", "ip");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_emailConfirmToken_key" ON "PlatformUser"("emailConfirmToken");

