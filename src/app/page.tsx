import { LanguageProvider } from "@/context/LanguageContext";
import {
  getLawyers,
  getQuickTags,
  getStats,
  getTemplates,
  getTerms,
} from "@/lib/api";
import { getCombinedGlossaryTermCount } from "@/lib/glossary";
import { getSaralSewaCategories } from "@/lib/saralsewa-glossary";
import { JsonLd } from "@/components/seo/JsonLd";
import { UserNav } from "@/components/user/UserNav";
import { Hero } from "@/components/user/Hero";
import { UserHome } from "@/components/user/UserHome";
import { LawyerSection } from "@/components/user/LawyerSection";
import { FaqSection } from "@/components/user/FaqSection";
import { UserFooter } from "@/components/user/UserFooter";
import { messages } from "@/i18n/messages";
import { buildPageMetadata, faqJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Nepal Government Glossary, Forms & Calculators",
  description:
    "Navigate Nepal government processes with confidence — 6,400+ legal terms, Sifaris guides, application templates, salary tax & EMI calculators. Free in English and Nepali.",
  path: "/",
  keywords: [
    "Nagarik Palika",
    "Nepal government guide",
    "Sifaris Nepal",
    "Kanuni Shabdakosh online",
    "Nepal application forms",
    "salary tax calculator Nepal",
  ],
});

export default async function HomePage() {
  const [stats, categories, terms, templates, quickTags, lawyers, glossaryTermsCount] =
    await Promise.all([
    getStats(),
    getSaralSewaCategories(),
    getTerms({ status: "published" }),
    getTemplates({ status: "published" }),
    getQuickTags(),
    getLawyers({ status: "published" }),
    getCombinedGlossaryTermCount(),
  ]);

  return (
    <LanguageProvider>
      <JsonLd data={faqJsonLd(messages.en.faqItems)} />
      <UserNav />
      <Hero quickTags={quickTags} />
      <UserHome
        stats={stats}
        glossaryTermsCount={glossaryTermsCount}
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
