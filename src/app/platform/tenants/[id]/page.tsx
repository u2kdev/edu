import { redirect } from "next/navigation";

export default function LegacyTenantDetailRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/platform-admin/centers/${params.id}`);
}
