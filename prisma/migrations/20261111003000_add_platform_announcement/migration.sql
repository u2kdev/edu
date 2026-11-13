-- CreateTable
CREATE TABLE "PlatformAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'ALL_CENTERS',
    "targetRoles" TEXT,
    "centerIds" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAnnouncement_publishedAt_idx" ON "PlatformAnnouncement"("publishedAt");

-- CreateIndex
CREATE INDEX "PlatformAnnouncement_expiresAt_idx" ON "PlatformAnnouncement"("expiresAt");

-- CreateIndex
CREATE INDEX "PlatformAnnouncement_createdBy_idx" ON "PlatformAnnouncement"("createdBy");

-- AddForeignKey
ALTER TABLE "PlatformAnnouncement" ADD CONSTRAINT "PlatformAnnouncement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
