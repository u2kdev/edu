-- Delete center memberships created for platform users (SUPERADMIN, DEVELOPER, PLATFORM_SUPPORT, PLATFORM_ADMIN)
-- Only deletes memberships that are not referenced by foreign keys (courses, grades, attendance, etc.)

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