import { describe, it, expect } from "vitest";
import { resolveNotificationRoute } from "../mobile/src/services/notifications";

describe("Mobile Push Notifications & Deep Linking", () => {
  it("resolves explicit deep link URL when provided in notification payload", () => {
    const route = resolveNotificationRoute({
      url: "/(student)?tab=homework",
      type: "CUSTOM_PROMO",
    });
    expect(route).toBe("/(student)?tab=homework");
  });

  it("routes HOMEWORK_ASSIGNED to student dashboard", () => {
    const route = resolveNotificationRoute({
      type: "HOMEWORK_ASSIGNED",
      homeworkId: "hw-123",
    });
    expect(route).toBe("/(student)");
  });

  it("routes LESSON_REMINDER to student dashboard", () => {
    const route = resolveNotificationRoute({
      type: "LESSON_REMINDER",
    });
    expect(route).toBe("/(student)");
  });

  it("routes GRADE_POSTED to parent dashboard when user role is PARENT", () => {
    const route = resolveNotificationRoute(
      {
        type: "GRADE_POSTED",
        childId: "child-99",
      },
      "PARENT"
    );
    expect(route).toBe("/(parent)");
  });

  it("routes GRADE_POSTED to student dashboard when user role is STUDENT", () => {
    const route = resolveNotificationRoute(
      {
        type: "GRADE_POSTED",
      },
      "STUDENT"
    );
    expect(route).toBe("/(student)");
  });

  it("routes ATTENDANCE_MISSED to parent dashboard when user role is PARENT", () => {
    const route = resolveNotificationRoute(
      {
        type: "ATTENDANCE_MISSED",
      },
      "PARENT"
    );
    expect(route).toBe("/(parent)");
  });

  it("routes SUBMISSION_RECEIVED to teacher workspace", () => {
    const route = resolveNotificationRoute({
      type: "SUBMISSION_RECEIVED",
      homeworkId: "hw-456",
    });
    expect(route).toBe("/(teacher)");
  });

  it("routes RISK_ALERT and NEW_ENROLLMENT to director workspace", () => {
    expect(resolveNotificationRoute({ type: "RISK_ALERT" })).toBe("/(director)");
    expect(resolveNotificationRoute({ type: "NEW_ENROLLMENT" })).toBe("/(director)");
  });

  it("routes PAYMENT_CONFIRMED based on role (parent vs director)", () => {
    expect(
      resolveNotificationRoute({ type: "PAYMENT_CONFIRMED" }, "PARENT")
    ).toBe("/(parent)");
    expect(
      resolveNotificationRoute({ type: "PAYMENT_CONFIRMED" }, "DIRECTOR")
    ).toBe("/(director)");
  });

  it("falls back to role default or root when data has unknown type", () => {
    expect(resolveNotificationRoute({ type: "UNKNOWN_EVENT" }, "TEACHER")).toBe("/(teacher)");
    expect(resolveNotificationRoute(null)).toBe("/");
    expect(resolveNotificationRoute({})).toBe("/");
  });
});
