import { redirect } from "next/navigation";

export default function LegacyTenantsCreateRedirectPage() {
  redirect("/platform-admin/centers/create");
}
