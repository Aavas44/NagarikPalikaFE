import type {
  CategoryCard,
  Lawyer,
  QuickTag,
  Stats,
  Template,
  Term,
} from "@/types";

function getApiBase(): string {
  if (typeof window !== "undefined") {
    return "/api";
  }
  return `${process.env.API_URL ?? "http://127.0.0.1:4000"}/api`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function getStats(): Promise<Stats> {
  return fetchJson<Stats>("/stats");
}

export function getTerms(params?: {
  category?: string;
  status?: string;
  search?: string;
}): Promise<Term[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString();
  return fetchJson<Term[]>(`/terms${query ? `?${query}` : ""}`);
}

export function getTemplates(params?: {
  category?: string;
  status?: string;
  search?: string;
}): Promise<Template[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString();
  return fetchJson<Template[]>(`/templates${query ? `?${query}` : ""}`);
}

export function getTemplate(slug: string): Promise<Template> {
  return fetchJson<Template>(`/templates/${encodeURIComponent(slug)}`);
}

export function getCategories(): Promise<CategoryCard[]> {
  return fetchJson<CategoryCard[]>("/categories");
}

export function getQuickTags(): Promise<QuickTag[]> {
  return fetchJson<QuickTag[]>("/quick-tags");
}

export function getLawyers(params?: {
  status?: string;
  search?: string;
}): Promise<Lawyer[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString();
  return fetchJson<Lawyer[]>(`/lawyers${query ? `?${query}` : ""}`);
}
