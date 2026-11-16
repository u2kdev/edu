import { redirect } from "next/navigation";

export default function CenterProfileRedirectPage() {
  redirect("/account?tab=profile");
}
