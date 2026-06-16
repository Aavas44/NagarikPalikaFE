import fs from "fs/promises";
import type {
  SaralSewaCategoryCard,
  SaralSewaEntry,
  SaralSewaGlossary,
} from "@/types/saralsewa";
import { dataFilePath } from "@/lib/dataPath";

const GLOSSARY_PATH = dataFilePath("saralsewa-nepali-government-glossary.json");

const CATEGORY_META: Record<
  string,
  { icon: string; iconColor: SaralSewaCategoryCard["iconColor"] }
> = {
  "Municipality Office": { icon: "🏛", iconColor: "blue" },
  "Land & Revenue Office": { icon: "📋", iconColor: "amber" },
  "Local Government": { icon: "🏘", iconColor: "green" },
  "Business & Industry": { icon: "🏭", iconColor: "teal" },
  "Legal & Judiciary": { icon: "⚖️", iconColor: "blue" },
};

let cached: SaralSewaGlossary | null = null;

async function loadGlossary(): Promise<SaralSewaGlossary> {
  if (cached) return cached;
  const raw = await fs.readFile(GLOSSARY_PATH, "utf-8");
  cached = JSON.parse(raw) as SaralSewaGlossary;
  return cached;
}

export function categoryToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function getSaralSewaCategories(): Promise<SaralSewaCategoryCard[]> {
  const data = await loadGlossary();
  return data.categories.map((cat) => {
    const meta = CATEGORY_META[cat.name] ?? { icon: "📖", iconColor: "blue" as const };
    return {
      slug: categoryToSlug(cat.name),
      name: cat.name,
      count: cat.count,
      icon: meta.icon,
      iconColor: meta.iconColor,
    };
  });
}

export async function getSaralSewaCategoryBySlug(
  slug: string
): Promise<{ category: SaralSewaCategoryCard; entries: SaralSewaEntry[] } | null> {
  const data = await loadGlossary();
  const category = data.categories.find((c) => categoryToSlug(c.name) === slug);
  if (!category) return null;

  const meta = CATEGORY_META[category.name] ?? { icon: "📖", iconColor: "blue" as const };
  const entries = data.entries
    .filter((e) => e.category === category.name)
    .sort((a, b) => a.number - b.number);

  return {
    category: {
      slug,
      name: category.name,
      count: category.count,
      icon: meta.icon,
      iconColor: meta.iconColor,
    },
    entries,
  };
}

export async function getAllCategorySlugs(): Promise<string[]> {
  const categories = await getSaralSewaCategories();
  return categories.map((c) => c.slug);
}
