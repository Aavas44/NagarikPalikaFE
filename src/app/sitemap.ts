import type { MetadataRoute } from "next";
import { CALCULATOR_ITEMS } from "@/lib/calculators";
import { getKanuniIndexCounts } from "@/lib/glossaryBrowse";
import { NEPALI_INDEX_LETTERS } from "@/lib/glossaryIndex";
import { getSaralSewaCategories } from "@/lib/saralsewa-glossary";
import { getSiteUrl } from "@/lib/siteUrl";

async function fetchPublishedTemplateSlugs(): Promise<string[]> {
  try {
    const apiBase = process.env.API_URL ?? "http://127.0.0.1:4000";
    const res = await fetch(`${apiBase}/api/templates?status=published`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const templates = (await res.json()) as { id: string }[];
    return templates.map((t) => t.id);
  } catch {
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, templateSlugs, indexCounts] = await Promise.all([
    getSaralSewaCategories(),
    fetchPublishedTemplateSlugs(),
    getKanuniIndexCounts(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    entry("/", { changeFrequency: "daily", priority: 1 }),
    entry("/terminology", { changeFrequency: "daily", priority: 0.9 }),
    entry("/calculators", { changeFrequency: "weekly", priority: 0.85 }),
    entry("/templates", { changeFrequency: "weekly", priority: 0.85 }),
    entry("/consult", { changeFrequency: "monthly", priority: 0.6 }),
  ];

  const terminologyLetters: MetadataRoute.Sitemap = NEPALI_INDEX_LETTERS.filter(
    (letter) => (indexCounts[letter] ?? 0) > 0
  ).map((letter) =>
    entry(`/terminology?letter=${encodeURIComponent(letter)}`, {
      changeFrequency: "weekly",
      priority: 0.75,
    })
  );

  const calculatorPages = CALCULATOR_ITEMS.map((item) =>
    entry(`/calculators/${item.slug}`, { priority: 0.8 })
  );

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
    ...categoryPages,
    ...templatePages,
  ];
}
