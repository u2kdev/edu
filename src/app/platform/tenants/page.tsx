import { redirect } from "next/navigation";

export default function LegacyTenantsRedirectPage() {
  redirect("/platform-admin/centers");
}
