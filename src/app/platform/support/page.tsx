import { redirect } from "next/navigation";

export default function LegacyPlatformSupportRedirectPage() {
  redirect("/platform-admin/support");
}
