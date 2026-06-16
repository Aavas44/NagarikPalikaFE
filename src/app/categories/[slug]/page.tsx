import { notFound } from "next/navigation";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { CategoryPageContent } from "@/components/user/CategoryPageContent";
import { getSaralSewaCategoryBySlug } from "@/lib/saralsewa-glossary";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const result = await getSaralSewaCategoryBySlug(slug);
  if (!result) notFound();

  return (
    <LanguageProvider>
      <UserNav />
      <CategoryPageContent category={result.category} entries={result.entries} />
      <UserFooter />
    </LanguageProvider>
  );
}
