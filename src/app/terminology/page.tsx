import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCombinedGlossaryTermCount } from "@/lib/glossary";
import { TerminologySearch } from "@/components/user/TerminologySearch";
import { TerminologySeoIntro } from "@/components/user/TerminologySeoIntro";
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  definedTermSetJsonLd,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

interface TerminologyPageProps {
  searchParams: Promise<{ letter?: string; q?: string; page?: string }>;
}

export async function generateMetadata({
  searchParams,
}: TerminologyPageProps): Promise<Metadata> {
  const { letter, q } = await searchParams;

  if (q?.trim()) {
    return buildPageMetadata({
      title: `Search: ${q.trim()}`,
      description: `Search results for "${q.trim()}" in the Nepal legal glossary (Kanuni Shabdakosh and SaralSewa).`,
      path: `/terminology?q=${encodeURIComponent(q.trim())}`,
      noIndex: true,
    });
  }

  if (letter?.trim()) {
    const letterChar = letter.trim();
    return buildPageMetadata({
      title: `${letterChar} — नेपाली कानूनी शब्द | Nepali Legal Terms`,
      description: `कानूनी शब्दकोश र सरल सेवाबाट "${letterChar}" बाट सुरु हुने शब्दहरू। Browse Nepal legal and government terms starting with ${letterChar} — Devanagari, Roman, and English.`,
      path: `/terminology?letter=${encodeURIComponent(letterChar)}`,
      keywords: [
        "कानूनी शब्दकोश",
        "Kanuni Shabdakosh",
        `${letterChar} shabdakosh`,
        "Nepali legal terms",
        "नेपाल सरकारी शब्दावली",
      ],
    });
  }

  return buildPageMetadata({
    title: "कानूनी शब्दकोश — Nepal Legal Glossary | Kanuni Shabdakosh & SaralSewa",
    description:
      "६,४००+ सरकारी र कानूनी शब्द खोज्नुहोस् — देवनागरी, रोमन र अंग्रेजीमा। Search Kanuni Shabdakosh & SaralSewa: Sifaris, Lalpurja, Malpot, ward office terms in English and Nepali.",
    path: "/terminology",
    keywords: [
      "कानूनी शब्दकोश",
      "Kanuni Shabdakosh",
      "Nepal legal dictionary",
      "नेपाली कानूनी शब्द",
      "सरल सेवा शब्दकोश",
      "Sifaris meaning",
      "लालपुर्जा अर्थ",
      "legal terms Nepal",
      "SaralSewa glossary",
      "नगरपालिका शब्दकोश",
    ],
  });
}

export default async function TerminologyPage({ searchParams }: TerminologyPageProps) {
  const { letter, q } = await searchParams;
  const glossaryTermsCount = await getCombinedGlossaryTermCount();

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Legal Glossary", path: "/terminology" },
    ...(letter?.trim()
      ? [{ name: `Letter ${letter.trim()}`, path: `/terminology?letter=${encodeURIComponent(letter.trim())}` }]
      : []),
  ]);

  const termSet = definedTermSetJsonLd({
    name: "Nepal Legal & Government Glossary",
    description:
      "Combined Kanuni Shabdakosh and SaralSewa government terminology for Nepal citizens.",
    path: letter?.trim()
      ? `/terminology?letter=${encodeURIComponent(letter.trim())}`
      : q?.trim()
        ? `/terminology?q=${encodeURIComponent(q.trim())}`
        : "/terminology",
    termCount: glossaryTermsCount,
  });

  return (
    <LanguageProvider>
      <JsonLd data={[breadcrumb, termSet]} />
      <UserNav />
      <main>
        <TerminologySeoIntro />
        <Suspense fallback={null}>
          <TerminologySearch glossaryTermsCount={glossaryTermsCount} />
        </Suspense>
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
