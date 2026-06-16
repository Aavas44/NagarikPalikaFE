import { LanguageProvider } from "@/context/LanguageContext";
import {
  getLawyers,
  getQuickTags,
  getStats,
  getTemplates,
  getTerms,
} from "@/lib/api";
import { getSaralSewaCategories } from "@/lib/saralsewa-glossary";
import { UserNav } from "@/components/user/UserNav";
import { Hero } from "@/components/user/Hero";
import { UserHome } from "@/components/user/UserHome";
import { LawyerSection } from "@/components/user/LawyerSection";
import { FaqSection } from "@/components/user/FaqSection";
import { UserFooter } from "@/components/user/UserFooter";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, categories, terms, templates, quickTags, lawyers] = await Promise.all([
    getStats(),
    getSaralSewaCategories(),
    getTerms({ status: "published" }),
    getTemplates({ status: "published" }),
    getQuickTags(),
    getLawyers({ status: "published" }),
  ]);

  return (
    <LanguageProvider>
      <UserNav />
      <Hero quickTags={quickTags} />
      <UserHome
        stats={stats}
        categories={categories}
        terms={terms}
        templates={templates}
      />
      <LawyerSection lawyers={lawyers} />
      <FaqSection />
      <UserFooter />
    </LanguageProvider>
  );
}
