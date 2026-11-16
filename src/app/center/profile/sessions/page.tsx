import { redirect } from "next/navigation";

export default function CenterSessionsRedirectPage() {
  redirect("/account?tab=security#sessions");
}
