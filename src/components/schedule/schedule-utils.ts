import { t } from "@/i18n";

export interface ScheduleSlotItem {
  id: string;
  groupId: string;
  teacherMembershipId: string;
  branchId?: string | null;
  subjectId?: string | null;
  roomName?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  status: string;
  cancelledReason?: string | null;
  group: {
    id: string;
    name: string;
    course: { title: string };
    subject?: { name: string; color?: string | null } | null;
  };
  teacher: {
    id: string;
    user: { fullName: string; email?: string | null };
  };
  branch?: { id: string; name: string } | null;
}

export interface UpcomingLessonItem {
  id: string;
  title: string;
  lessonType: string;
  status: string;
  scheduledAt?: string | Date | null;
  durationMinutes: number;
  onlineMeetingUrl?: string | null;
  location?: string | null;
  cancelledReason?: string | null;
  module: {
    course: { title: string };
  };
  substituteTeacher?: {
    id: string;
    user: { fullName: string };
  } | null;
}

export type ScheduleViewMode = "day" | "week" | "month";

export interface ScheduleGroupOption {
  id: string;
  name: string;
}

export interface ScheduleTeacherOption {
  id: string;
  user: { fullName: string };
}

export interface ScheduleFormData {
  groupId: string;
  teacherMembershipId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomName: string;
  status: string;
  cancelledReason: string;
}

export const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7];

export function buildDayNamesShort(locale: string): Record<number, string> {
  return {
    1: t(locale, "schedule.monShort"),
    2: t(locale, "schedule.tueShort"),
    3: t(locale, "schedule.wedShort"),
    4: t(locale, "schedule.thuShort"),
    5: t(locale, "schedule.friShort"),
    6: t(locale, "schedule.satShort"),
    7: t(locale, "schedule.sunShort"),
  };
}

export function buildDayNamesFull(locale: string): Record<number, string> {
  return {
    1: t(locale, "schedule.monday"),
    2: t(locale, "schedule.tuesday"),
    3: t(locale, "schedule.wednesday"),
    4: t(locale, "schedule.thursday"),
    5: t(locale, "schedule.friday"),
    6: t(locale, "schedule.saturday"),
    7: t(locale, "schedule.sunday"),
  };
}

export function filterScheduleSlots(
  slots: ScheduleSlotItem[],
  selectedGroupId: string,
  selectedTeacherId: string,
  searchQuery: string
): ScheduleSlotItem[] {
  return slots.filter((slot) => {
    if (selectedGroupId && slot.groupId !== selectedGroupId) return false;
    if (selectedTeacherId && slot.teacherMembershipId !== selectedTeacherId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchGroup = slot.group.name.toLowerCase().includes(q);
      const matchCourse = slot.group.course.title.toLowerCase().includes(q);
      const matchRoom = slot.roomName?.toLowerCase().includes(q) || false;
      const matchTeacher = slot.teacher.user.fullName.toLowerCase().includes(q);
      if (!matchGroup && !matchCourse && !matchRoom && !matchTeacher) return false;
    }
    return true;
  });
}

export function groupSlotsByDay(
  slots: ScheduleSlotItem[]
): Record<number, ScheduleSlotItem[]> {
  const slotsByDay: Record<number, ScheduleSlotItem[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
  };
  slots.forEach((slot) => {
    if (slotsByDay[slot.dayOfWeek]) {
      slotsByDay[slot.dayOfWeek].push(slot);
    }
  });
  return slotsByDay;
}

export function formatLessonDateTime(scheduledAt: string | Date, locale: string): string {
  return new Date(scheduledAt).toLocaleString(locale === "ru" ? "ru-RU" : "uz-UZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
