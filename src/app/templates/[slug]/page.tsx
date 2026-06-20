import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { TemplatePageContent } from "@/components/user/TemplatePageContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { getTemplate } from "@/lib/api";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

interface TemplatePageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: TemplatePageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const template = await getTemplate(slug);
    const title = template.name.en;
    const description =
      template.description.en ||
      `Download and use the ${title} application template for Nepal government processes.`;

    return buildPageMetadata({
      title,
      description,
      path: `/templates/${slug}`,
      keywords: [
        title,
        "Nepal application form",
        "government template Nepal",
        template.category,
      ],
    });
  } catch {
    return buildPageMetadata({
      title: "Template Not Found",
      description: "The requested application template could not be found.",
      path: "/templates",
      noIndex: true,
    });
  }
}

export default async function TemplatePage({ params }: TemplatePageProps) {
  const { slug } = await params;

  let template;
  try {
    template = await getTemplate(slug);
  } catch {
    notFound();
  }

  return (
    <LanguageProvider>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Application Templates", path: "/templates" },
          { name: template.name.en, path: `/templates/${slug}` },
        ])}
      />
      <UserNav />
      <main>
        <TemplatePageContent template={template} />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
