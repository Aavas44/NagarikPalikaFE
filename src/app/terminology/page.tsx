import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCombinedGlossaryTermCount } from "@/lib/glossary";
import { TerminologySearch } from "@/components/user/TerminologySearch";
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
    return buildPageMetadata({
      title: `Nepali Legal Terms — ${letter.trim()}`,
      description: `Browse Nepal legal and government terms starting with "${letter.trim()}" from Kanuni Shabdakosh and SaralSewa glossary.`,
      path: `/terminology?letter=${encodeURIComponent(letter.trim())}`,
      keywords: [
        "Kanuni Shabdakosh",
        "Nepali legal terms",
        `${letter} shabdakosh`,
        "Nepal government terminology",
      ],
    });
  }

  return buildPageMetadata({
    title: "Nepal Legal Glossary — Kanuni Shabdakosh & SaralSewa",
    description:
      "Search 6,400+ Nepali legal and government terms with English meanings. Kanuni Shabdakosh dictionary plus SaralSewa ward office glossary — Sifaris, Likhat, Malpot, and more.",
    path: "/terminology",
    keywords: [
      "Kanuni Shabdakosh",
      "Nepal legal dictionary",
      "Nepali government glossary",
      "Sifaris meaning",
      "legal terms Nepal",
      "SaralSewa glossary",
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
        <Suspense fallback={null}>
          <TerminologySearch glossaryTermsCount={glossaryTermsCount} />
        </Suspense>
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
