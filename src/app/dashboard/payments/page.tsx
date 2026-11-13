import { redirect } from "next/navigation";

export default function DashboardPaymentsRedirect() {
  redirect("/center/payments");
}
