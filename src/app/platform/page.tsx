import { redirect } from "next/navigation";

export default function LegacyPlatformRedirectPage() {
  redirect("/platform-admin");
}
