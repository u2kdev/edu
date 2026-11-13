import { db } from "./db";

export interface LimitUsageItem {
  resource: "students" | "teachers" | "courses" | "branches";
  label: string;
  current: number;
  max: number;
  percent: number;
  isWarning: boolean; // >= 90%
  isReached: boolean; // >= 100%
}

export interface CenterSubscriptionSummary {
  subscription: {
    id: string;
    status: string;
    planName: string;
    daysRemaining: number;
    isTrial: boolean;
    expiresAt: Date | null;
  } | null;
  limits: LimitUsageItem[];
  hasWarnings: boolean;
}

export async function checkSubscriptionLimit(
  centerId: string,
  resourceType: "students" | "teachers" | "courses" | "branches",
  incrementAmount: number = 1
): Promise<boolean> {
  const subscription = await db.subscription.findFirst({
    where: { centerId, status: { in: ["ACTIVE", "TRIAL"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    // If no active subscription, default to denying creation of major resources
    return false;
  }

  const { plan } = subscription;

  if (resourceType === "students") {
    const currentCount = await db.centerMembership.count({
      where: { centerId, role: "STUDENT", status: { not: "ARCHIVED" } },
    });
    return currentCount + incrementAmount <= plan.maxStudents;
  }

  if (resourceType === "teachers") {
    const currentCount = await db.centerMembership.count({
      where: { centerId, role: { in: ["TEACHER", "TEACHER_ASSISTANT"] } },
    });
    return currentCount + incrementAmount <= plan.maxTeachers;
  }

  if (resourceType === "courses") {
    const currentCount = await db.course.count({
      where: { centerId },
    });
    return currentCount + incrementAmount <= plan.maxCourses;
  }

  if (resourceType === "branches") {
    const currentCount = await db.branch.count({
      where: { centerId },
    });
    return currentCount + incrementAmount <= plan.maxBranches;
  }

  return true;
}

export async function getCenterSubscriptionUsage(
  centerId: string
): Promise<CenterSubscriptionSummary> {
  const [subscription, studentCount, teacherCount, courseCount, branchCount] =
    await Promise.all([
      db.subscription.findFirst({
        where: { centerId },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      }),
      db.centerMembership.count({
        where: { centerId, role: "STUDENT", status: { not: "ARCHIVED" } },
      }),
      db.centerMembership.count({
        where: { centerId, role: { in: ["TEACHER", "TEACHER_ASSISTANT"] }, status: { not: "ARCHIVED" } },
      }),
      db.course.count({
        where: { centerId },
      }),
      db.branch.count({
        where: { centerId },
      }),
    ]);

  const maxStudents = subscription?.plan?.maxStudents ?? 0;
  const maxTeachers = subscription?.plan?.maxTeachers ?? 0;
  const maxCourses = subscription?.plan?.maxCourses ?? 0;
  const maxBranches = subscription?.plan?.maxBranches ?? 1;

  const buildItem = (
    resource: "students" | "teachers" | "courses" | "branches",
    label: string,
    current: number,
    max: number
  ): LimitUsageItem => {
    const percent = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
    return {
      resource,
      label,
      current,
      max,
      percent,
      isWarning: percent >= 90 && percent < 100,
      isReached: percent >= 100,
    };
  };

  const limits: LimitUsageItem[] = [
    buildItem("students", "Студенты", studentCount, maxStudents),
    buildItem("teachers", "Учителя и помощники", teacherCount, maxTeachers),
    buildItem("courses", "Курсы", courseCount, maxCourses),
    buildItem("branches", "Филиалы", branchCount, maxBranches),
  ];

  let daysRemaining = 0;
  let expiresAt: Date | null = null;
  const isTrial = subscription?.status === "TRIAL";

  if (subscription) {
    expiresAt = isTrial && subscription.trialEndsAt ? subscription.trialEndsAt : subscription.currentPeriodEndsAt;
    if (expiresAt) {
      daysRemaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }
  }

  return {
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          planName: subscription.plan.name,
          daysRemaining,
          isTrial,
          expiresAt,
        }
      : null,
    limits,
    hasWarnings: limits.some((l) => l.isWarning || l.isReached),
  };
}
