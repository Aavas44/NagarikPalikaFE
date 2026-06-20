import { LanguageProvider } from "@/context/LanguageContext";
import { getQuickTags, getStats, getTemplates } from "@/lib/api";
import { getCombinedGlossaryTermCount } from "@/lib/glossary";
import { getSaralSewaCategories } from "@/lib/saralsewa-glossary";
import { JsonLd } from "@/components/seo/JsonLd";
import { UserNav } from "@/components/user/UserNav";
import { Hero } from "@/components/user/Hero";
import { UserHome } from "@/components/user/UserHome";
import { FaqSection } from "@/components/user/FaqSection";
import { UserFooter } from "@/components/user/UserFooter";
import { messages } from "@/i18n/messages";
import { buildPageMetadata, faqJsonLd } from "@/lib/seo";
import pageStyles from "@/app/user.module.css";
import emiStyles from "@/components/user/emi.module.css";

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
  const [stats, categories, templates, quickTags, glossaryTermsCount] =
    await Promise.all([
    getStats(),
    getSaralSewaCategories(),
    getTemplates({ status: "published" }),
    getQuickTags(),
    getCombinedGlossaryTermCount(),
  ]);

  return (
    <LanguageProvider>
      <JsonLd data={faqJsonLd(messages.en.faqItems)} />
      <UserNav />
      <section className={pageStyles.calculatorPage}>
        <div className={`${pageStyles.calculatorPageInner} ${emiStyles.emiPageInner}`}>
          <Hero quickTags={quickTags} />
          <UserHome
            stats={stats}
            glossaryTermsCount={glossaryTermsCount}
            categories={categories}
            templates={templates}
          />
        </div>
      </section>
      <FaqSection />
      <UserFooter />
    </LanguageProvider>
  );
}
