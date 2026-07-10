import fs from "fs";
import path from "path";
import { toArabicDigits } from "./nepali-digits";
import { bookScopeToNormalizeAct, type BookScope } from "./lawbooks";

export type NormalizeActId =
  | "devani"
  | "devani_karyavidhi"
  | "aparadh"
  | "faujdari_karyavidhi";

export type DafaTaxonomyEntry = {
  label: string;
  title: string;
  displayLine: string;
  sectionRoot: number;
};

export type DafaTaxonomyFile = {
  bookId: string;
  act: string;
  normalizeActId: NormalizeActId;
  sourceFile: string;
  generatedAt: string;
  entryCount: number;
  entries: DafaTaxonomyEntry[];
};

const TAXONOMY_DIR = path.join(process.cwd(), "src/data/sajilokanun/dafa-taxonomy");

const ALL_NORMALIZE_ACTS: NormalizeActId[] = [
  "devani",
  "devani_karyavidhi",
  "aparadh",
  "faujdari_karyavidhi",
];

const ACT_ENGLISH_NAMES: Record<NormalizeActId, string> = {
  devani: "Muluki Devani Samhita 2074",
  devani_karyavidhi: "Muluki Devani Karyavidhi Samhita 2074",
  aparadh: "Muluki Aparadh Samhita 2074",
  faujdari_karyavidhi: "Muluki Faujdari Karyavidhi Samhita 2074",
};

const taxonomyCache = new Map<string, DafaTaxonomyFile>();

function taxonomyPathForBookId(bookId: string): string {
  return path.join(TAXONOMY_DIR, `${bookId}.json`);
}

export function loadDafaTaxonomyByBookId(bookId: string): DafaTaxonomyFile | null {
  const cached = taxonomyCache.get(bookId);
  if (cached) return cached;

  const filePath = taxonomyPathForBookId(bookId);
  if (!fs.existsSync(filePath)) return null;

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as DafaTaxonomyFile;
  taxonomyCache.set(bookId, raw);
  return raw;
}

export function loadDafaTaxonomyForAct(act: NormalizeActId): DafaTaxonomyFile | null {
  const bookId =
    act === "devani"
      ? "civil-code"
      : act === "devani_karyavidhi"
        ? "civil-procedure"
        : act === "aparadh"
          ? "criminal-code"
          : "criminal-procedure";
  return loadDafaTaxonomyByBookId(bookId);
}

export function resolveNormalizeActsForScope(
  bookScope?: BookScope
): NormalizeActId[] {
  if (!bookScope || bookScope === "auto") return ALL_NORMALIZE_ACTS;
  const act = bookScopeToNormalizeAct(bookScope);
  return act ? [act] : ALL_NORMALIZE_ACTS;
}

/** Compact दफा title list for Gemini normalize prompt. */
export function formatDafaTaxonomyForPrompt(bookScope?: BookScope): string {
  const acts = resolveNormalizeActsForScope(bookScope);
  const blocks: string[] = [];

  for (const act of acts) {
    const tax = loadDafaTaxonomyForAct(act);
    if (!tax?.entries.length) continue;
    blocks.push(
      `#### ${ACT_ENGLISH_NAMES[act]}\n${tax.entries.map((e) => e.displayLine).join("\n")}`
    );
  }

  return blocks.join("\n\n");
}

function normalizeMatchKey(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[ः:.…]/g, "")
    .trim()
    .toLowerCase();
}

/** Map Gemini `matching_dafa_names` lines → root दफा integers using indexed taxonomy. */
export function resolveDafaNumbersFromMatchingNames(
  names: string[],
  act?: string
): number[] {
  if (names.length === 0) return [];

  const acts: NormalizeActId[] = act
    ? (() => {
        const fromAct = Object.entries(ACT_ENGLISH_NAMES).find(
          ([, english]) => english === act.trim()
        )?.[0] as NormalizeActId | undefined;
        return fromAct ? [fromAct] : ALL_NORMALIZE_ACTS;
      })()
    : ALL_NORMALIZE_ACTS;

  const byDisplay = new Map<string, number>();
  const byTitle = new Map<string, number>();

  for (const normalizeAct of acts) {
    const tax = loadDafaTaxonomyForAct(normalizeAct);
    if (!tax) continue;
    for (const entry of tax.entries) {
      byDisplay.set(normalizeMatchKey(entry.displayLine), entry.sectionRoot);
      byTitle.set(normalizeMatchKey(entry.title), entry.sectionRoot);
      byDisplay.set(normalizeMatchKey(`${entry.label}. ${entry.title}`), entry.sectionRoot);
    }
  }

  const roots: number[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;

    const key = normalizeMatchKey(trimmed);
    let root = byDisplay.get(key) ?? byTitle.get(key);

    if (root == null) {
      const labelMatch = trimmed.match(/^([\d०-९]+[क-ह]?)\./u);
      if (labelMatch) {
        root = sectionRootFromLabel(labelMatch[1]);
      }
    }

    if (root != null && root > 0 && !roots.includes(root)) {
      roots.push(root);
    }
  }

  return roots.slice(0, 3);
}

function sectionRootFromLabel(label: string): number {
  const digits = label.replace(/[क-ह]$/u, "");
  const n = Number(toArabicDigits(digits));
  return Number.isFinite(n) ? n : 0;
}

export function taxonomyPromptFingerprint(bookScope?: BookScope): string {
  const acts = resolveNormalizeActsForScope(bookScope);
  const parts: string[] = [];
  for (const act of acts) {
    const tax = loadDafaTaxonomyForAct(act);
    parts.push(tax ? `${tax.bookId}:${tax.entryCount}:${tax.generatedAt}` : `${act}:missing`);
  }
  return parts.join("|");
}
