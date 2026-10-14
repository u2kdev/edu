import { db } from "./db";

/**
 * Retrieve the active subscription plan for a center or tenant onboarding.
 * Strictly guarantees that fallback plans are never auto-created at runtime in production.
 */
export async function getActiveSubscriptionPlan(planId?: string) {
  if (planId) {
    return db.subscriptionPlan.findUnique({
      where: { id: planId },
    });
  }

  return db.subscriptionPlan.findFirst({
    where: { isActive: true },
  });
}

/**
 * Guard preventing implicit creation of fallback plans in production.
 * Any plan creation must be explicit via database seed or platform admin endpoints.
 */
export function assertNoAutomaticPlanCreation(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Automatic fallback subscription plan creation is strictly forbidden in production");
  }
}
