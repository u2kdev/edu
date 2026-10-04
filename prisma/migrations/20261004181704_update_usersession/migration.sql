-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "platformRole" TEXT NOT NULL DEFAULT 'NONE',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'ru',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LearningCenter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centerType" TEXT NOT NULL DEFAULT 'HYBRID',
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "logoUrl" TEXT,
    "brandingConfig" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'ru',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Tashkent',
    "gradingScale" TEXT NOT NULL DEFAULT 'PERCENT_100',
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearningCenter_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "PlatformUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "maxStudents" INTEGER NOT NULL,
    "maxTeachers" INTEGER NOT NULL,
    "maxCourses" INTEGER NOT NULL,
    "maxBranches" INTEGER NOT NULL DEFAULT 1,
    "maxStorage" INTEGER NOT NULL DEFAULT 5120,
    "priceMonthly" REAL NOT NULL,
    "featuresJson" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" DATETIME,
    "currentPeriodStartsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEndsAt" DATETIME NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Branch_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subject_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CenterMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "permissions" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CenterMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CenterMembership_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL DEFAULT 'STUDENT',
    "courseId" TEXT,
    "groupId" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "createdByMembershipId" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InviteCode_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InviteCode_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InviteCode_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InviteCode_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParentLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentMembershipId" TEXT NOT NULL,
    "studentMembershipId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "initiatedBy" TEXT NOT NULL DEFAULT 'ADMIN',
    "inviteCodeUsed" TEXT,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParentLink_parentMembershipId_fkey" FOREIGN KEY ("parentMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParentLink_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "subjectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "priceMonthly" REAL NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdByMembershipId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Course_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Course_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Course_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "centerId" TEXT NOT NULL,
    CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseModule_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleId" TEXT NOT NULL,
    "scheduleSlotId" TEXT,
    "title" TEXT NOT NULL,
    "lessonType" TEXT NOT NULL DEFAULT 'OFFLINE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" DATETIME,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "content" TEXT,
    "videoUrl" TEXT,
    "onlineMeetingUrl" TEXT,
    "location" TEXT,
    "attachmentsJson" TEXT,
    "substituteTeacherMembershipId" TEXT,
    "cancelledReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "centerId" TEXT NOT NULL,
    CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lesson_scheduleSlotId_fkey" FOREIGN KEY ("scheduleSlotId") REFERENCES "ScheduleSlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lesson_substituteTeacherMembershipId_fkey" FOREIGN KEY ("substituteTeacherMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lesson_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teacherMembershipId" TEXT NOT NULL,
    "branchId" TEXT,
    "subjectId" TEXT,
    "roomName" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "overrideDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cancelledReason" TEXT,
    "createdByMemberId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleSlot_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleSlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleSlot_teacherMembershipId_fkey" FOREIGN KEY ("teacherMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleSlot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "branchId" TEXT,
    "subjectId" TEXT,
    "name" TEXT NOT NULL,
    "teacherMembershipId" TEXT,
    "assistantMembershipId" TEXT,
    "maxStudents" INTEGER NOT NULL DEFAULT 30,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Group_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Group_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_teacherMembershipId_fkey" FOREIGN KEY ("teacherMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_assistantMembershipId_fkey" FOREIGN KEY ("assistantMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "studentMembershipId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Enrollment_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "studentMembershipId" TEXT NOT NULL,
    "groupId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "markedByMembershipId" TEXT NOT NULL,
    "markedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Attendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendance_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendance_markedByMembershipId_fkey" FOREIGN KEY ("markedByMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME,
    "attachmentsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "centerId" TEXT NOT NULL,
    CONSTRAINT "Homework_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Homework_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "homeworkId" TEXT NOT NULL,
    "studentMembershipId" TEXT NOT NULL,
    "groupId" TEXT,
    "submissionText" TEXT,
    "filesJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "grade" INTEGER,
    "feedback" TEXT,
    "gradedByMembershipId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "centerId" TEXT NOT NULL,
    CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HomeworkSubmission_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HomeworkSubmission_gradedByMembershipId_fkey" FOREIGN KEY ("gradedByMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HomeworkSubmission_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "studentMembershipId" TEXT NOT NULL,
    "groupId" TEXT,
    "lessonId" TEXT,
    "teacherMembershipId" TEXT NOT NULL,
    "gradeType" TEXT NOT NULL DEFAULT 'HOMEWORK',
    "value" REAL NOT NULL,
    "maxValue" REAL NOT NULL DEFAULT 100,
    "comment" TEXT,
    "lifecycle" TEXT NOT NULL DEFAULT 'DRAFT',
    "homeworkSubmissionId" TEXT,
    "finalizedAt" DATETIME,
    "finalizedById" TEXT,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Grade_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Grade_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Grade_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Grade_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Grade_teacherMembershipId_fkey" FOREIGN KEY ("teacherMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Grade_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "CenterMembership" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Grade_homeworkSubmissionId_fkey" FOREIGN KEY ("homeworkSubmissionId") REFERENCES "HomeworkSubmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CenterPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "studentMembershipId" TEXT NOT NULL,
    "groupId" TEXT,
    "amount" REAL NOT NULL,
    "originalAmount" REAL,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "installmentIndex" INTEGER,
    "externalTxId" TEXT,
    "note" TEXT,
    "paidAt" DATETIME,
    "refundedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CenterPayment_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CenterPayment_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CenterPayment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetRole" TEXT,
    "groupId" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Announcement_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "CenterMembership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Announcement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT,
    "creatorUserId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "scope" TEXT NOT NULL DEFAULT 'TENANT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportTicket_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "PlatformUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentsJson" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "PlatformUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "detailsJson" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "PlatformUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jtiHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT,
    "centerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "materialType" TEXT NOT NULL DEFAULT 'LECTURE',
    "contentText" TEXT,
    "fileUrl" TEXT,
    "externalUrl" TEXT,
    "durationMinutes" INTEGER,
    "pagesRange" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Material_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "timeLimitMinutes" INTEGER,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "passingScorePercent" INTEGER NOT NULL DEFAULT 60,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "centerId" TEXT NOT NULL,
    CONSTRAINT "Test_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Test_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" TEXT NOT NULL DEFAULT 'SINGLE_CHOICE',
    "optionsJson" TEXT,
    "correctAnswer" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "centerId" TEXT NOT NULL,
    CONSTRAINT "TestQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestQuestion_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testId" TEXT NOT NULL,
    "studentMembershipId" TEXT NOT NULL,
    "answersJson" TEXT,
    "scorePercent" REAL,
    "scorePoints" INTEGER,
    "maxPoints" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "centerId" TEXT NOT NULL,
    CONSTRAINT "TestAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestAttempt_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestAttempt_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HomeworkMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "homeworkId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    CONSTRAINT "HomeworkMaterial_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HomeworkMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerformanceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentMembershipId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "averageGrade" REAL,
    "attendancePercent" REAL,
    "homeworkCompletionPercent" REAL,
    "trend" TEXT NOT NULL DEFAULT 'STABLE',
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerformanceSnapshot_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PerformanceSnapshot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userMembershipId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userMembershipId_fkey" FOREIGN KEY ("userMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityLog_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "centerId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "titleKey" TEXT NOT NULL,
    "bodyKey" TEXT NOT NULL,
    "bodyParams" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AcademicTerm_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Holiday_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");

-- CreateIndex
CREATE INDEX "PlatformUser_email_idx" ON "PlatformUser"("email");

-- CreateIndex
CREATE INDEX "PlatformUser_phone_idx" ON "PlatformUser"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCenter_slug_key" ON "LearningCenter"("slug");

-- CreateIndex
CREATE INDEX "LearningCenter_slug_idx" ON "LearningCenter"("slug");

-- CreateIndex
CREATE INDEX "LearningCenter_ownerId_idx" ON "LearningCenter"("ownerId");

-- CreateIndex
CREATE INDEX "Subscription_centerId_idx" ON "Subscription"("centerId");

-- CreateIndex
CREATE INDEX "Branch_centerId_idx" ON "Branch"("centerId");

-- CreateIndex
CREATE INDEX "Subject_centerId_idx" ON "Subject"("centerId");

-- CreateIndex
CREATE INDEX "CenterMembership_userId_idx" ON "CenterMembership"("userId");

-- CreateIndex
CREATE INDEX "CenterMembership_centerId_idx" ON "CenterMembership"("centerId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterMembership_userId_centerId_role_key" ON "CenterMembership"("userId", "centerId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_code_idx" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_centerId_idx" ON "InviteCode"("centerId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentLink_parentMembershipId_studentMembershipId_key" ON "ParentLink"("parentMembershipId", "studentMembershipId");

-- CreateIndex
CREATE INDEX "Course_centerId_idx" ON "Course"("centerId");

-- CreateIndex
CREATE INDEX "Course_subjectId_idx" ON "Course"("subjectId");

-- CreateIndex
CREATE INDEX "CourseModule_centerId_idx" ON "CourseModule"("centerId");

-- CreateIndex
CREATE INDEX "CourseModule_courseId_idx" ON "CourseModule"("courseId");

-- CreateIndex
CREATE INDEX "Lesson_centerId_idx" ON "Lesson"("centerId");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_idx" ON "Lesson"("moduleId");

-- CreateIndex
CREATE INDEX "Lesson_scheduleSlotId_idx" ON "Lesson"("scheduleSlotId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_centerId_idx" ON "ScheduleSlot"("centerId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_groupId_idx" ON "ScheduleSlot"("groupId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_teacherMembershipId_idx" ON "ScheduleSlot"("teacherMembershipId");

-- CreateIndex
CREATE INDEX "Group_courseId_idx" ON "Group"("courseId");

-- CreateIndex
CREATE INDEX "Group_teacherMembershipId_idx" ON "Group"("teacherMembershipId");

-- CreateIndex
CREATE INDEX "Enrollment_centerId_idx" ON "Enrollment"("centerId");

-- CreateIndex
CREATE INDEX "Enrollment_groupId_idx" ON "Enrollment"("groupId");

-- CreateIndex
CREATE INDEX "Enrollment_studentMembershipId_idx" ON "Enrollment"("studentMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentMembershipId_groupId_key" ON "Enrollment"("studentMembershipId", "groupId");

-- CreateIndex
CREATE INDEX "Attendance_lessonId_idx" ON "Attendance"("lessonId");

-- CreateIndex
CREATE INDEX "Attendance_studentMembershipId_idx" ON "Attendance"("studentMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_lessonId_studentMembershipId_key" ON "Attendance"("lessonId", "studentMembershipId");

-- CreateIndex
CREATE INDEX "Homework_centerId_idx" ON "Homework"("centerId");

-- CreateIndex
CREATE INDEX "Homework_lessonId_idx" ON "Homework"("lessonId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_centerId_idx" ON "HomeworkSubmission"("centerId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_homeworkId_idx" ON "HomeworkSubmission"("homeworkId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_studentMembershipId_idx" ON "HomeworkSubmission"("studentMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_homeworkId_studentMembershipId_key" ON "HomeworkSubmission"("homeworkId", "studentMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_homeworkSubmissionId_key" ON "Grade"("homeworkSubmissionId");

-- CreateIndex
CREATE INDEX "Grade_centerId_idx" ON "Grade"("centerId");

-- CreateIndex
CREATE INDEX "Grade_studentMembershipId_idx" ON "Grade"("studentMembershipId");

-- CreateIndex
CREATE INDEX "Grade_groupId_idx" ON "Grade"("groupId");

-- CreateIndex
CREATE INDEX "Grade_teacherMembershipId_idx" ON "Grade"("teacherMembershipId");

-- CreateIndex
CREATE INDEX "CenterPayment_centerId_idx" ON "CenterPayment"("centerId");

-- CreateIndex
CREATE INDEX "CenterPayment_studentMembershipId_idx" ON "CenterPayment"("studentMembershipId");

-- CreateIndex
CREATE INDEX "CenterPayment_status_idx" ON "CenterPayment"("status");

-- CreateIndex
CREATE INDEX "Announcement_centerId_idx" ON "Announcement"("centerId");

-- CreateIndex
CREATE INDEX "Announcement_publishAt_idx" ON "Announcement"("publishAt");

-- CreateIndex
CREATE INDEX "SupportTicket_creatorUserId_idx" ON "SupportTicket"("creatorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_centerId_idx" ON "AuditLog"("centerId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_jtiHash_key" ON "UserSession"("jtiHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_jtiHash_idx" ON "UserSession"("jtiHash");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Material_lessonId_idx" ON "Material"("lessonId");

-- CreateIndex
CREATE INDEX "Material_centerId_idx" ON "Material"("centerId");

-- CreateIndex
CREATE UNIQUE INDEX "Test_materialId_key" ON "Test"("materialId");

-- CreateIndex
CREATE INDEX "Test_centerId_idx" ON "Test"("centerId");

-- CreateIndex
CREATE INDEX "TestQuestion_centerId_idx" ON "TestQuestion"("centerId");

-- CreateIndex
CREATE INDEX "TestQuestion_testId_idx" ON "TestQuestion"("testId");

-- CreateIndex
CREATE INDEX "TestAttempt_centerId_idx" ON "TestAttempt"("centerId");

-- CreateIndex
CREATE INDEX "TestAttempt_testId_idx" ON "TestAttempt"("testId");

-- CreateIndex
CREATE INDEX "TestAttempt_studentMembershipId_idx" ON "TestAttempt"("studentMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkMaterial_homeworkId_materialId_key" ON "HomeworkMaterial"("homeworkId", "materialId");

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_studentMembershipId_idx" ON "PerformanceSnapshot"("studentMembershipId");

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_groupId_idx" ON "PerformanceSnapshot"("groupId");

-- CreateIndex
CREATE INDEX "ActivityLog_userMembershipId_idx" ON "ActivityLog"("userMembershipId");

-- CreateIndex
CREATE INDEX "ActivityLog_centerId_idx" ON "ActivityLog"("centerId");

-- CreateIndex
CREATE INDEX "ActivityLog_activityType_idx" ON "ActivityLog"("activityType");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_centerId_idx" ON "Notification"("centerId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "AcademicTerm_centerId_idx" ON "AcademicTerm"("centerId");

-- CreateIndex
CREATE INDEX "Holiday_centerId_idx" ON "Holiday"("centerId");
