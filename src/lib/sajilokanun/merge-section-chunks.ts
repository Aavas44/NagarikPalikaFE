import { type MatchedChunk } from "./supabase";

function sectionPartOrder(
  sectionLabel: string | null | undefined,
  sectionNum: string
): number {
  if (!sectionLabel || sectionLabel === sectionNum) return 0;
  if (new RegExp(`^${sectionNum}\\.8(?:\\.|$)`).test(sectionLabel)) return 1;
  const suffix = sectionLabel.replace(`${sectionNum}.`, "");
  if (/^[1-7](?:\.|$)/.test(suffix)) return 3;
  return 2;
}

function compareSectionParts(
  a: MatchedChunk,
  b: MatchedChunk,
  sectionNum: string
): number {
  const order =
    sectionPartOrder(a.section_label, sectionNum) -
    sectionPartOrder(b.section_label, sectionNum);
  if (order !== 0) return order;
  return (a.page_number ?? 0) - (b.page_number ?? 0);
}

function provisionBody(content: string): string {
  return content.split("\n").slice(1).join("\n").trim();
}

/** Karyavidhi दफा २ only: 2.1–2.7 are (१)–(७) exclusion items under (घ), not continuations. */
function isKaryavidhiExclusionPart(
  sectionLabel: string | null | undefined,
  sectionNum: string,
  filename: string
): boolean {
  if (
    !/karyavidhi|देवानी.*कार्यविधि|muluki[_\s-]?devani[_\s-]?karyavidhi/i.test(
      filename
    )
  ) {
    return false;
  }
  if (!sectionLabel || sectionLabel === sectionNum) return false;
  return new RegExp(`^${sectionNum}\\.[1-7](?:\\.|$)`).test(sectionLabel);
}

/** Main chunk + char-split continuations (2.8.x). Skip karyavidhi exclusion items (2.1–2.7). */
function isDefinitionPart(
  sectionLabel: string | null | undefined,
  sectionNum: string,
  filename: string
): boolean {
  if (!sectionLabel || sectionLabel === sectionNum) return true;
  if (new RegExp(`^${sectionNum}\\.8`).test(sectionLabel)) return true;
  if (isKaryavidhiExclusionPart(sectionLabel, sectionNum, filename)) {
    return false;
  }
  return true;
}

/** Stitch split sub-chunks (2, 2.8.1, 2.8.2, …) into one chunk per book. */
export function mergeSectionChunks(
  chunks: MatchedChunk[],
  sectionNum: string
): MatchedChunk[] {
  const groups = new Map<string, MatchedChunk[]>();
  const standalone: MatchedChunk[] = [];

  for (const chunk of chunks) {
    const base = chunk.section_label?.split(".")[0];
    if (!base || base !== sectionNum) {
      standalone.push(chunk);
      continue;
    }
    if (!isDefinitionPart(chunk.section_label, sectionNum, chunk.filename)) {
      continue;
    }

    const key = `${chunk.filename}|${base}`;
    const list = groups.get(key) ?? [];
    list.push(chunk);
    groups.set(key, list);
  }

  const merged: MatchedChunk[] = [...standalone];

  for (const [, parts] of groups) {
    if (parts.length === 1) {
      merged.push(parts[0]);
      continue;
    }

    const sorted = [...parts].sort((a, b) =>
      compareSectionParts(a, b, sectionNum)
    );
    const first = sorted[0];
    const header = first.content.split("\n")[0] ?? "";
    const body = sorted
      .map((p) => provisionBody(p.content))
      .filter(Boolean)
      .join("\n\n");

    merged.push({
      ...first,
      content: `${header}\n${body}`,
      section_label: sectionNum,
    });
  }

  return merged.sort((a, b) => a.filename.localeCompare(b.filename));
}
