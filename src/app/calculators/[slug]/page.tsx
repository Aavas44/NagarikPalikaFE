import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { CalculatorPageContent } from "@/components/user/CalculatorPageContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { CALCULATOR_ITEMS, isCalculatorSlug } from "@/lib/calculators";
import {
  CALCULATOR_SEO,
  breadcrumbJsonLd,
  buildPageMetadata,
  faqJsonLd,
  webApplicationJsonLd,
} from "@/lib/seo";
import { messages } from "@/i18n/messages";
import { SalaryTaxSeoContent } from "@/components/user/SalaryTaxSeoContent";

interface CalculatorPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CalculatorPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isCalculatorSlug(slug)) {
    return buildPageMetadata({
      title: "Calculator Not Found",
      description: "The requested calculator could not be found.",
      path: "/calculators",
      noIndex: true,
    });
  }

  const seo = CALCULATOR_SEO[slug];
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: `/calculators/${slug}`,
    keywords: seo.keywords,
  });
}

export function generateStaticParams() {
  return CALCULATOR_ITEMS.map((item) => ({ slug: item.slug }));
}

export default async function CalculatorPage({ params }: CalculatorPageProps) {
  const { slug } = await params;

  if (!isCalculatorSlug(slug)) {
    notFound();
  }

  const seo = CALCULATOR_SEO[slug];
  const jsonLd: Record<string, unknown>[] = [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Calculators", path: "/calculators" },
      { name: seo.title, path: `/calculators/${slug}` },
    ]),
    webApplicationJsonLd({
      name: seo.title,
      description: seo.description,
      path: `/calculators/${slug}`,
    }),
  ];

  if (slug === "salary-tax") {
    jsonLd.push(faqJsonLd(messages.en.calculators.salaryTaxSeo.faq));
  }

  return (
    <LanguageProvider>
      <JsonLd data={jsonLd} />
      <UserNav />
      <main>
        <CalculatorPageContent slug={slug} />
        {slug === "salary-tax" && <SalaryTaxSeoContent />}
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
