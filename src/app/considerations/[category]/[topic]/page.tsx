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
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
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

  return buildPageMetadata({
    title: `${titleEn} — Key Considerations Nepal`,
    description: descEn,
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

  return (
    <LanguageProvider>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Key Considerations", path: "/considerations" },
          { name: categoryTitleEn, path: `/considerations/${categorySlug}` },
          { name: topicTitleEn, path: `/considerations/${categorySlug}/${topicSlug}` },
        ])}
      />
      <UserNav />
      <main>
        <ConsiderationTopicContent
          categorySlug={match.category.slug}
          categoryLabelKey={match.category.labelKey}
          topicLabelKey={match.topic.labelKey}
          topicDescriptionKey={match.topic.descriptionKey}
        />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
