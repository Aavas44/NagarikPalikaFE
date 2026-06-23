import { notFound } from "next/navigation";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { ConsiderationTopicContent } from "@/components/user/ConsiderationTopicContent";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  CONSIDERATION_CATEGORIES,
  getConsiderationTopic,
  isConsiderationCategorySlug,
} from "@/lib/considerations";
import { breadcrumbJsonLd, buildPageMetadata, CONSIDERATION_SEO, faqJsonLd } from "@/lib/seo";
import { messages } from "@/i18n/messages";

type PageProps = {
  params: Promise<{ category: string; topic: string }>;
};

export async function generateStaticParams() {
  return CONSIDERATION_CATEGORIES.flatMap((category) =>
    category.topics.map((topic) => ({
      category: category.slug,
      topic: topic.slug,
    }))
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { category: categorySlug, topic: topicSlug } = await params;
  const match = getConsiderationTopic(categorySlug, topicSlug);
  if (!match) return {};

  const titleEn = messages.en.considerations[match.topic.labelKey];
  const descEn = messages.en.considerations[match.topic.descriptionKey];
  const seoKey = `${categorySlug}/${topicSlug}`;
  const seo = CONSIDERATION_SEO[seoKey];

  return buildPageMetadata({
    title: seo?.title ?? `${titleEn} — Key Considerations Nepal`,
    description: seo?.description ?? descEn,
    keywords: seo?.keywords,
    path: `/considerations/${categorySlug}/${topicSlug}`,
  });
}

export default async function ConsiderationTopicPage({ params }: PageProps) {
  const { category: categorySlug, topic: topicSlug } = await params;
  if (!isConsiderationCategorySlug(categorySlug)) notFound();

  const match = getConsiderationTopic(categorySlug, topicSlug);
  if (!match) notFound();

  const categoryTitleEn = messages.en.considerations[match.category.labelKey];
  const topicTitleEn = messages.en.considerations[match.topic.labelKey];
  const seoKey = `${categorySlug}/${topicSlug}`;
  const seo = CONSIDERATION_SEO[seoKey];
  const jsonLd: Record<string, unknown>[] = [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Key Considerations", path: "/considerations" },
      { name: categoryTitleEn, path: `/considerations/${categorySlug}` },
      { name: topicTitleEn, path: `/considerations/${categorySlug}/${topicSlug}` },
    ]),
  ];
  if (seo?.faq?.length) {
    jsonLd.push(faqJsonLd(seo.faq));
  }

  return (
    <LanguageProvider>
      <JsonLd data={jsonLd} />
      <UserNav />
      <main>
        <ConsiderationTopicContent
          categorySlug={match.category.slug}
          topicSlug={match.topic.slug}
          categoryLabelKey={match.category.labelKey}
          topicLabelKey={match.topic.labelKey}
          topicDescriptionKey={match.topic.descriptionKey}
        />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
