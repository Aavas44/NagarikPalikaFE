import type { MetadataRoute } from "next";
import { CALCULATOR_ITEMS } from "@/lib/calculators";
import { CONSIDERATION_CATEGORIES } from "@/lib/considerations";
import { hasConsiderationArticle } from "@/lib/considerationArticles";
import { getKanuniIndexCounts } from "@/lib/glossaryBrowse";
import { NEPALI_INDEX_LETTERS } from "@/lib/glossaryIndex";
import { getSaralSewaCategories } from "@/lib/saralsewa-glossary";
import { getSiteUrl } from "@/lib/siteUrl";

/** Cache sitemap for 1 hour — avoids cold-start failures on every Google crawl. */
export const revalidate = 3600;

async function fetchPublishedTemplateSlugs(): Promise<string[]> {
  try {
    const apiBase = process.env.API_URL ?? "http://127.0.0.1:4000";
    const res = await fetch(`${apiBase}/api/templates?status=published`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const templates = (await res.json()) as { id: string }[];
    return templates.map((t) => t.id);
  } catch (err) {
    console.error("sitemap: failed to fetch templates", err);
    return [];
  }
}

function entry(
  path: string,
  options?: { changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"]; priority?: number }
): MetadataRoute.Sitemap[number] {
  const siteUrl = getSiteUrl();
  return {
    url: `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`,
    lastModified: new Date(),
    changeFrequency: options?.changeFrequency ?? "weekly",
    priority: options?.priority ?? 0.7,
  };
}

async function loadIndexCounts(): Promise<Record<string, number>> {
  try {
    return await getKanuniIndexCounts();
  } catch (err) {
    console.error("sitemap: failed to load glossary index counts", err);
    return {};
  }
}

async function loadCategories() {
  try {
    return await getSaralSewaCategories();
  } catch (err) {
    console.error("sitemap: failed to load categories", err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, templateSlugs, indexCounts] = await Promise.all([
    loadCategories(),
    fetchPublishedTemplateSlugs(),
    loadIndexCounts(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    entry("/", { changeFrequency: "daily", priority: 1 }),
    entry("/terminology", { changeFrequency: "daily", priority: 0.9 }),
    entry("/calculators", { changeFrequency: "weekly", priority: 0.85 }),
    entry("/considerations", { changeFrequency: "weekly", priority: 0.85 }),
    entry("/templates", { changeFrequency: "weekly", priority: 0.85 }),
    entry("/about", { changeFrequency: "monthly", priority: 0.65 }),
    entry("/terms", { changeFrequency: "monthly", priority: 0.35 }),
  ];

  const terminologyLetters: MetadataRoute.Sitemap = NEPALI_INDEX_LETTERS.filter(
    (letter) => (indexCounts[letter] ?? 0) > 0
  ).map((letter) =>
    entry(`/terminology?letter=${encodeURIComponent(letter)}`, {
      changeFrequency: "weekly",
      priority: 0.75,
    })
  );

  const calculatorPages = CALCULATOR_ITEMS.filter((item) => item.available).map((item) =>
    entry(`/calculators/${item.slug}`, { priority: 0.8 })
  );

  const considerationPages = CONSIDERATION_CATEGORIES.flatMap((category) => [
    entry(`/considerations/${category.slug}`, { priority: 0.75 }),
    ...category.topics.map((topic) => {
      const hasArticle = hasConsiderationArticle(category.slug, topic.slug);
      return entry(`/considerations/${category.slug}/${topic.slug}`, {
        priority: hasArticle ? 0.85 : 0.7,
        changeFrequency: hasArticle ? "weekly" : "monthly",
      });
    }),
  ]);

  const categoryPages = categories.map((cat) =>
    entry(`/categories/${cat.slug}`, { priority: 0.75 })
  );

  const templatePages = templateSlugs.map((slug) =>
    entry(`/templates/${encodeURIComponent(slug)}`, { priority: 0.7 })
  );

  return [
    ...staticPages,
    ...terminologyLetters,
    ...calculatorPages,
    ...considerationPages,
    ...categoryPages,
    ...templatePages,
  ];
}
