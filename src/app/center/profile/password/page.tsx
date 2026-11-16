import { redirect } from "next/navigation";

export default function CenterPasswordRedirectPage() {
  redirect("/account?tab=security");
}
