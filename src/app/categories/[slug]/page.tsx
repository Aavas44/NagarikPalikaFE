import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { CategoryPageContent } from "@/components/user/CategoryPageContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { getSaralSewaCategoryBySlug } from "@/lib/saralsewa-glossary";
import { breadcrumbJsonLd, buildPageMetadata, definedTermSetJsonLd } from "@/lib/seo";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getSaralSewaCategoryBySlug(slug);

  if (!result) {
    return buildPageMetadata({
      title: "Category Not Found",
      description: "The requested glossary category could not be found.",
      path: "/",
      noIndex: true,
    });
  }

  const { category } = result;
  return buildPageMetadata({
    title: `${category.name} — Government Glossary`,
    description: `Browse ${category.count} ${category.name} terms explained in English and Nepali — Nepal government and legal terminology from SaralSewa glossary.`,
    path: `/categories/${slug}`,
    keywords: [
      category.name,
      "Nepal government glossary",
      "SaralSewa terms",
      "ward office terminology",
    ],
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const result = await getSaralSewaCategoryBySlug(slug);
  if (!result) notFound();

  const { category, entries } = result;

  return (
    <LanguageProvider>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: category.name, path: `/categories/${slug}` },
          ]),
          definedTermSetJsonLd({
            name: `${category.name} — Nepal Government Terms`,
            description: `SaralSewa glossary terms for ${category.name}.`,
            path: `/categories/${slug}`,
            termCount: entries.length,
          }),
        ]}
      />
      <UserNav />
      <CategoryPageContent category={category} entries={entries} />
      <UserFooter />
    </LanguageProvider>
  );
}
