import { redirect } from "next/navigation";

export default function LegacyTenantDetailsRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/platform-admin/centers/${params.id}`);
}
