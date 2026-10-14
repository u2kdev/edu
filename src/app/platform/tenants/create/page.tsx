import { redirect } from "next/navigation";

export default function LegacyTenantCreateRedirectPage() {
  redirect("/platform-admin/centers/create");
}
