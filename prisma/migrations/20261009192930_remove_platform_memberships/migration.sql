-- 1. Transfer nullable relations pointing to platform user memberships to NULL:
UPDATE "Group"
SET "teacherMembershipId" = NULL
WHERE "teacherMembershipId" IN (
  SELECT cm.id FROM "CenterMembership" cm
  JOIN "PlatformUser" pu ON cm."userId" = pu.id
  WHERE pu."platformRole" IN ('SUPERADMIN', 'DEVELOPER', 'PLATFORM_SUPPORT', 'PLATFORM_ADMIN')
);

UPDATE "Group"
SET "assistantMembershipId" = NULL
WHERE "assistantMembershipId" IN (
  SELECT cm.id FROM "CenterMembership" cm
  JOIN "PlatformUser" pu ON cm."userId" = pu.id
  WHERE pu."platformRole" IN ('SUPERADMIN', 'DEVELOPER', 'PLATFORM_SUPPORT', 'PLATFORM_ADMIN')
);

UPDATE "Lesson"
SET "substituteTeacherMembershipId" = NULL
WHERE "substituteTeacherMembershipId" IN (
  SELECT cm.id FROM "CenterMembership" cm
  JOIN "PlatformUser" pu ON cm."userId" = pu.id
  WHERE pu."platformRole" IN ('SUPERADMIN', 'DEVELOPER', 'PLATFORM_SUPPORT', 'PLATFORM_ADMIN')
);

UPDATE "HomeworkSubmission"
SET "gradedByMembershipId" = NULL
WHERE "gradedByMembershipId" IN (
  SELECT cm.id FROM "CenterMembership" cm
  JOIN "PlatformUser" pu ON cm."userId" = pu.id
  WHERE pu."platformRole" IN ('SUPERADMIN', 'DEVELOPER', 'PLATFORM_SUPPORT', 'PLATFORM_ADMIN')
);

UPDATE "Grade"
SET "finalizedById" = NULL
WHERE "finalizedById" IN (
  SELECT cm.id FROM "CenterMembership" cm
  JOIN "PlatformUser" pu ON cm."userId" = pu.id
  WHERE pu."platformRole" IN ('SUPERADMIN', 'DEVELOPER', 'PLATFORM_SUPPORT', 'PLATFORM_ADMIN')
);

-- 2. Delete CenterMembership of platform users that have no blocking foreign keys:
DELETE FROM "CenterMembership" cm
USING "PlatformUser" pu
WHERE cm."userId" = pu.id
  AND pu."platformRole" IN ('SUPERADMIN', 'DEVELOPER', 'PLATFORM_SUPPORT', 'PLATFORM_ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "Course" c WHERE c."createdByMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "Grade" g WHERE g."teacherMembershipId" = cm.id OR g."studentMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "Attendance" a WHERE a."markedByMembershipId" = cm.id OR a."studentMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "ScheduleSlot" ss WHERE ss."teacherMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "Group" gr WHERE gr."teacherMembershipId" = cm.id OR gr."assistantMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."studentMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "InviteCode" ic WHERE ic."createdByMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "ParentLink" pl WHERE pl."parentMembershipId" = cm.id OR pl."studentMembershipId" = cm.id);