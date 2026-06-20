import { notFound } from "next/navigation";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { ConsiderationCategoryContent } from "@/components/user/ConsiderationCategoryContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { getConsiderationCategory, isConsiderationCategorySlug, CONSIDERATION_CATEGORIES } from "@/lib/considerations";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { messages } from "@/i18n/messages";

type PageProps = {
  params: Promise<{ category: string }>;
};

export function generateStaticParams() {
  return CONSIDERATION_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { category: categorySlug } = await params;
  const category = getConsiderationCategory(categorySlug);
  if (!category) return {};

  const titleEn = messages.en.considerations[category.labelKey];
  const descEn = messages.en.considerations[category.descriptionKey];

  return buildPageMetadata({
    title: `${titleEn} — Key Considerations Nepal`,
    description: descEn,
    path: `/considerations/${categorySlug}`,
  });
}

export default async function ConsiderationCategoryPage({ params }: PageProps) {
  const { category: categorySlug } = await params;
  if (!isConsiderationCategorySlug(categorySlug)) notFound();

  const category = getConsiderationCategory(categorySlug);
  if (!category) notFound();

  const titleEn = messages.en.considerations[category.labelKey];

  return (
    <LanguageProvider>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Key Considerations", path: "/considerations" },
          { name: titleEn, path: `/considerations/${categorySlug}` },
        ])}
      />
      <UserNav />
      <main>
        <ConsiderationCategoryContent
          categorySlug={category.slug}
          icon={category.icon}
          labelKey={category.labelKey}
          descriptionKey={category.descriptionKey}
          topics={category.topics}
        />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
