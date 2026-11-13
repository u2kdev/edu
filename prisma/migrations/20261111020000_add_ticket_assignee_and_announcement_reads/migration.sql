-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN "assignedToId" TEXT;

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PlatformAnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAnnouncementRead_announcementId_userId_key" ON "PlatformAnnouncementRead"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "PlatformAnnouncementRead_announcementId_idx" ON "PlatformAnnouncementRead"("announcementId");

-- CreateIndex
CREATE INDEX "PlatformAnnouncementRead_userId_idx" ON "PlatformAnnouncementRead"("userId");

-- AddForeignKey
ALTER TABLE "PlatformAnnouncementRead" ADD CONSTRAINT "PlatformAnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "PlatformAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAnnouncementRead" ADD CONSTRAINT "PlatformAnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
