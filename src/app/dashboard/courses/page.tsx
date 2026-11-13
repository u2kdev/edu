import { redirect } from "next/navigation";

export default function DashboardCoursesRedirect() {
  redirect("/center/courses");
}
