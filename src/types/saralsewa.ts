export interface SaralSewaEntry {
  category: string;
  number: number;
  term: string;
  "Roman Transliteration": string;
  english: string | null;
  meaningNe: string | null;
  meaningEn: string | null;
}

export interface SaralSewaCategory {
  name: string;
  count: number;
}

export interface SaralSewaGlossary {
  source: string;
  title: string;
  count: number;
  categories: SaralSewaCategory[];
  entries: SaralSewaEntry[];
}

export interface SaralSewaCategoryCard {
  slug: string;
  name: string;
  count: number;
  icon: string;
  iconColor: "blue" | "green" | "amber" | "teal";
}
