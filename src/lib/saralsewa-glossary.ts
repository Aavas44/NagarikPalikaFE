import fs from "fs/promises";
import type {
  SaralSewaCategoryCard,
  SaralSewaEntry,
  SaralSewaGlossary,
} from "@/types/saralsewa";
import type { GlossarySearchResult } from "@/types/glossary";
import { dataFilePath } from "@/lib/dataPath";
import { scoreGlossaryLabels } from "@/lib/glossarySearchCore";

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

export async function getSaralSewaEntries(): Promise<SaralSewaEntry[]> {
  const data = await loadGlossary();
  return data.entries;
}

export async function getSaralSewaGlossaryCount(): Promise<number> {
  const entries = await getSaralSewaEntries();
  return entries.filter((entry) => entry.meaningNe?.trim() || entry.meaningEn?.trim()).length;
}

function scoreSaralSewaEntry(entry: SaralSewaEntry, query: string): number {
  return scoreGlossaryLabels(query, {
    term: entry.term,
    roman: entry["Roman Transliteration"] ?? "",
    english: entry.english,
  });
}

export async function searchSaralSewaGlossary(
  query: string,
  limit = 30
): Promise<{ total: number; results: GlossarySearchResult[] }> {
  const data = await loadGlossary();
  const trimmed = query.trim();

  if (!trimmed) {
    return { total: 0, results: [] };
  }

  const scored = data.entries
    .map((entry) => ({
      entry,
      score: scoreSaralSewaEntry(entry, trimmed),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.term.localeCompare(b.entry.term));

  const results: GlossarySearchResult[] = scored.slice(0, limit).map(({ entry, score }) => ({
    term: entry.term,
    romanTransliteration: entry["Roman Transliteration"],
    english: entry.english,
    meaning: entry.meaningNe ?? "",
    meaningNe: entry.meaningNe,
    meaningEn: entry.meaningEn,
    source: "saralsewa",
    score,
  }));

  return { total: scored.length, results };
}
