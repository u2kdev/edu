import { redirect } from "next/navigation";

export default function AccountSecurityRedirectPage() {
  redirect("/account?tab=security");
}
