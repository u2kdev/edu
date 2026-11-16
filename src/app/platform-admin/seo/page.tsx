import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Globe, Share2 } from "lucide-react";
import { getPlatformSetting, type PlatformSeoSetting } from "@/lib/platform-settings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui";
import SEOFormClient from "./SEOFormClient";

export default async function SEOAdminPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const allowedRoles = ["SUPERADMIN", "PLATFORM_ADMIN", "SEO_ADMIN", "FULL_ACCESS"];
  if (!allowedRoles.includes(session.user.platformRole)) {
    redirect("/center");
  }

  let seo: PlatformSeoSetting | null = null;
  try {
    seo = await getPlatformSetting("platform.seo");
  } catch {
    seo = null;
  }

  const defaultTitle =
    seo?.metaTitleRu || "AcademiaSaaS — Multi-tenant LMS платформа для учебных центров";
  const defaultDesc =
    seo?.metaDescRu ||
    "Закрытая LMS-система для офлайн и онлайн учебных центров. Ведение курсов, групп, расписания и оценок без комиссии с учеников.";
  const defaultOgImage = seo?.ogImageUrl || "https://academiasaas.com/og-banner.png";
  const defaultKeywords =
    seo?.keywords || "LMS, учебный центр, CRM для курсов, Узбекистан LMS, образование";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Панель SEO и Контента Платформы"
        description="Управление мета-тегами, анонсами и страницами платформы"
      />

      <SEOFormClient
        initialTitle={defaultTitle}
        initialDesc={defaultDesc}
        initialOgImage={defaultOgImage}
        initialKeywords={defaultKeywords}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Мета-теги главной страницы (SEO)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Meta Title (ru)" htmlFor="seo-meta-title">
                <Input id="seo-meta-title" type="text" name="metaTitleRu" defaultValue={defaultTitle} />
              </FormField>
              <FormField label="Meta Description (ru)" htmlFor="seo-meta-desc">
                <Textarea id="seo-meta-desc" rows={3} name="metaDescRu" defaultValue={defaultDesc} />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Share2 className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>OpenGraph &amp; Социальные сети</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="OG Image URL" htmlFor="seo-og-image">
                <Input id="seo-og-image" type="text" name="ogImageUrl" defaultValue={defaultOgImage} />
              </FormField>
              <FormField label="Ключевые слова (Keywords)" htmlFor="seo-keywords">
                <Input id="seo-keywords" type="text" name="keywords" defaultValue={defaultKeywords} />
              </FormField>
            </CardContent>
          </Card>
        </div>
      </SEOFormClient>
    </div>
  );
}
