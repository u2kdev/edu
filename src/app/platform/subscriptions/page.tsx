import { redirect } from "next/navigation";

export default function LegacyPlatformSubscriptionsRedirectPage() {
  redirect("/platform-admin/plans");
}
