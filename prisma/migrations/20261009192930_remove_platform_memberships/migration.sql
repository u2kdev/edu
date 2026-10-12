-- Delete phantom CenterMembership created by platform impersonation.
-- Preserves all memberships with real business data (courses, groups, grades, attendance, etc.).
DELETE FROM "CenterMembership" cm
USING "PlatformUser" pu
WHERE cm."userId" = pu.id
  AND pu."platformRole" IN ('SUPERADMIN', 'DEVELOPER', 'PLATFORM_SUPPORT', 'PLATFORM_ADMIN')
  AND cm."role" = 'DIRECTOR'
  AND NOT EXISTS (SELECT 1 FROM "Course" c WHERE c."createdByMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "Grade" g WHERE g."teacherMembershipId" = cm.id OR g."studentMembershipId" = cm.id OR g."finalizedById" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "Attendance" a WHERE a."markedByMembershipId" = cm.id OR a."studentMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "ScheduleSlot" ss WHERE ss."teacherMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "Group" gr WHERE gr."teacherMembershipId" = cm.id OR gr."assistantMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "Lesson" l WHERE l."substituteTeacherMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "HomeworkSubmission" hs WHERE hs."studentMembershipId" = cm.id OR hs."gradedByMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "InviteCode" ic WHERE ic."createdByMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "ParentLink" pl WHERE pl."parentMembershipId" = cm.id OR pl."studentMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."studentMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "CenterPayment" cp WHERE cp."studentMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "Announcement" an WHERE an."authorId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "TestAttempt" ta WHERE ta."studentMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "PerformanceSnapshot" ps WHERE ps."studentMembershipId" = cm.id)
  AND NOT EXISTS (SELECT 1 FROM "ActivityLog" al WHERE al."userMembershipId" = cm.id);