import { db } from "./db";

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
      where: { centerId, role: "STUDENT" },
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
