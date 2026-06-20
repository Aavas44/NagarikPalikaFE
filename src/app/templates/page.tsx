import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { TemplatesListContent } from "@/components/user/TemplatesListContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { getTemplates } from "@/lib/api";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Nepal Government Application Templates & Forms",
  description:
    "Download and browse common Nepal government application forms and templates — citizenship, Sifaris, ward office, Malpot, and local government paperwork.",
  path: "/templates",
  keywords: [
    "Nepal application forms",
    "government templates Nepal",
    "Sifaris form",
    "citizenship application Nepal",
    "ward office forms",
  ],
});

export default async function TemplatesPage() {
  const templates = await getTemplates({ status: "published" });

  return (
    <LanguageProvider>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Application Templates", path: "/templates" },
        ])}
      />
      <UserNav />
      <main>
        <TemplatesListContent templates={templates} />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
