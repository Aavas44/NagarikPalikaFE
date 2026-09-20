/**
 * Resolve which parties to fill into a template: applicant side (वादी vs प्रतिवादी)
 * and either one selected person or all co-parties ("समेत राखेर").
 */
import {
  foldPartyName,
  partyHasContent,
  type ExtractedCaseDocument,
  type ExtractedPartyDetails,
  type NibedakSide,
} from "@/lib/sajilokanun/document-prompts/extract-case-document";

export type CasePartySide = "plaintiff" | "defendant" | "other";

export type PartyFillParticipant = {
  id: string;
  accountId: string;
  name: string;
  contactNo?: string;
};

export type PartyFillMode = {
  /**
   * Represented-side people to include, e.g. `ocr:0`, `ocr:1`, `user:<accountId>`.
   * Empty / omitted = all people on the case’s plaintiff or defendant side.
   */
  selectedPartyIds?: string[] | null;
  /** @deprecated Use selectedPartyIds. Kept so older callers still compile. */
  selectedUserId?: string | null;
  casePartySide?: CasePartySide | null;
  participants?: PartyFillParticipant[];
};

export type ResolvedPartyFill = {
  side: NibedakSide;
  sideSource: "ocr" | "overlap" | "case" | "default";
  mode: "single" | "samet";
  applicants: ExtractedPartyDetails[];
  opponents: ExtractedPartyDetails[];
  plaintiffs: ExtractedPartyDetails[];
  defendants: ExtractedPartyDetails[];
};

export const SAMET_USER_ID = "samet";

function namedParties(list: ExtractedPartyDetails[]): ExtractedPartyDetails[] {
  return list.filter((party) => partyHasContent(party) && Boolean(party.पूरा_नाम?.trim()));
}

export function namesSimilar(a: string, b: string): boolean {
  const left = foldPartyName(a);
  const right = foldPartyName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < 4 || right.length < 4) return false;
  return left.includes(right) || right.includes(left);
}

export function matchPartyByName(
  parties: ExtractedPartyDetails[],
  name: string
): ExtractedPartyDetails | null {
  const needle = name.trim();
  if (!needle) return null;
  return parties.find((party) => namesSimilar(party.पूरा_नाम ?? "", needle)) ?? null;
}

export function formatSametName(parties: ExtractedPartyDetails[]): string {
  const names = parties
    .map((party) => party.पूरा_नाम?.trim() || "")
    .filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names[0]} समेत`;
}

export function classifyApplicantSide(
  _extracted: ExtractedCaseDocument,
  casePartySide?: CasePartySide | null
): { side: NibedakSide; source: ResolvedPartyFill["sideSource"] } {
  if (casePartySide === "defendant") {
    return { side: "प्रतिवादी", source: "case" };
  }
  if (casePartySide === "plaintiff") {
    return { side: "वादी", source: "case" };
  }
  return { side: "वादी", source: "default" };
}

/** People on the side this case represents (वादी or प्रतिवादी from case setup). */
export function representedParties(
  extracted: ExtractedCaseDocument,
  casePartySide?: CasePartySide | null
): ExtractedPartyDetails[] {
  if (casePartySide === "defendant") {
    const defendants = namedParties(extracted.प्रतिवादी_विवरण);
    return defendants.length > 0
      ? defendants
      : namedParties(extracted.निवेदक_विवरण);
  }
  const plaintiffs = namedParties(extracted.वादी_विवरण);
  return plaintiffs.length > 0
    ? plaintiffs
    : namedParties(extracted.निवेदक_विवरण);
}

export function opposingParties(
  extracted: ExtractedCaseDocument,
  casePartySide?: CasePartySide | null
): ExtractedPartyDetails[] {
  if (casePartySide === "defendant") {
    const plaintiffs = namedParties(extracted.वादी_विवरण);
    return plaintiffs.length > 0
      ? plaintiffs
      : namedParties(extracted.विपक्षी_विवरण);
  }
  const defendants = namedParties(extracted.प्रतिवादी_विवरण);
  return defendants.length > 0
    ? defendants
    : namedParties(extracted.विपक्षी_विवरण);
}

export function ocrPartyId(index: number): string {
  return `ocr:${index}`;
}

export function ocrOpponentPartyId(index: number): string {
  return `ocr:opp:${index}`;
}

export function allOcrPartyIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => ocrPartyId(index));
}

function parseOwnOcrIndex(id: string): number | null {
  const match = id.trim().match(/^ocr:(?:own:|applicant:)?(\d+)$/i);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function parseOppOcrIndex(id: string): number | null {
  const match = id.trim().match(/^ocr:opp:(\d+)$/i);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function partyFromParticipant(
  user: PartyFillParticipant
): ExtractedPartyDetails {
  return {
    पूरा_नाम: user.name.trim() || null,
    तीनपुस्ते: null,
    ठेगाना: null,
    नागरिकता_नं: null,
    उमेर: null,
    लिङ्ग: null,
    सम्पर्क: user.contactNo?.trim() || null,
    टिप्पणी: null,
  };
}

function enrichParty(
  party: ExtractedPartyDetails,
  pool: ExtractedPartyDetails[]
): ExtractedPartyDetails {
  const match = matchPartyByName(pool, party.पूरा_नाम ?? "");
  if (!match) return party;
  return {
    पूरा_नाम: party.पूरा_नाम || match.पूरा_नाम,
    तीनपुस्ते: party.तीनपुस्ते || match.तीनपुस्ते,
    ठेगाना: party.ठेगाना || match.ठेगाना,
    नागरिकता_नं: party.नागरिकता_नं || match.नागरिकता_नं,
    उमेर: party.उमेर || match.उमेर,
    लिङ्ग: party.लिङ्ग || match.लिङ्ग,
    सम्पर्क: party.सम्पर्क || match.सम्पर्क,
    टिप्पणी: party.टिप्पणी || match.टिप्पणी,
  };
}

function parseOcrIndex(id: string): number | null {
  return parseOwnOcrIndex(id);
}

function idsFromLegacyUserId(selectedUserId: string | null | undefined): string[] | null {
  const selected = (selectedUserId ?? "").trim();
  if (!selected || selected === SAMET_USER_ID) return null;
  if (parseOcrIndex(selected) != null) return [selected.replace(/^ocr:applicant:/i, "ocr:")];
  return [`user:${selected}`];
}

export function resolvePartiesForGeneration(
  extracted: ExtractedCaseDocument,
  options: PartyFillMode = {}
): ResolvedPartyFill {
  const classified = classifyApplicantSide(extracted, options.casePartySide);
  const side = classified.side;
  const pool = representedParties(extracted, options.casePartySide).map((party) =>
    enrichParty(party, namedParties(extracted.निवेदक_विवरण))
  );
  const opponents = opposingParties(extracted, options.casePartySide);
  const participants = options.participants ?? [];

  const selectedIds =
    options.selectedPartyIds && options.selectedPartyIds.length > 0
      ? options.selectedPartyIds
      : idsFromLegacyUserId(options.selectedUserId);

  const applicants: ExtractedPartyDetails[] = [];
  let pickedOwn = 0;
  let pickedOpp = 0;
  if (selectedIds && selectedIds.length > 0) {
    const seen = new Set<string>();
    for (const id of selectedIds) {
      const oppIndex = parseOppOcrIndex(id);
      if (oppIndex != null && opponents[oppIndex] && !seen.has(`ocr:opp:${oppIndex}`)) {
        seen.add(`ocr:opp:${oppIndex}`);
        applicants.push(opponents[oppIndex]);
        pickedOpp += 1;
        continue;
      }
      const ocrIndex = parseOwnOcrIndex(id);
      if (ocrIndex != null && pool[ocrIndex] && !seen.has(`ocr:${ocrIndex}`)) {
        seen.add(`ocr:${ocrIndex}`);
        applicants.push(pool[ocrIndex]);
        pickedOwn += 1;
        continue;
      }
      const userId = id.replace(/^user:/, "");
      const user = participants.find(
        (row) => row.accountId === userId || row.id === userId || row.accountId === id
      );
      if (!user?.name.trim() || seen.has(`user:${user.accountId}`)) continue;
      seen.add(`user:${user.accountId}`);
      const matched =
        matchPartyByName(pool, user.name) ??
        matchPartyByName(opponents, user.name) ??
        matchPartyByName(applicants, user.name);
      if (matched && opponents.some((row) => row === matched || namesSimilar(row.पूरा_नाम ?? "", matched.पूरा_नाम ?? ""))) {
        pickedOpp += 1;
      } else {
        pickedOwn += 1;
      }
      applicants.push(
        matched
          ? { ...matched, सम्पर्क: matched.सम्पर्क || user.contactNo?.trim() || null }
          : partyFromParticipant(user)
      );
    }
  }

  const chosen = applicants.length > 0 ? applicants : pool;
  const formOpponents =
    pickedOpp > 0 && pickedOwn === 0 ? pool : opponents;
  return {
    side,
    sideSource: classified.source,
    mode: chosen.length > 1 ? "samet" : "single",
    applicants: chosen,
    opponents: formOpponents,
    plaintiffs: side === "वादी" ? chosen : formOpponents,
    defendants: side === "प्रतिवादी" ? chosen : formOpponents,
  };
}

function cloneParties(list: ExtractedPartyDetails[]): ExtractedPartyDetails[] {
  return list.map((party) => ({ ...party }));
}

/** Keep निवेदक/विपक्षी aliases aligned when editing the true वादी list. */
export function withPlaintiffList(
  doc: ExtractedCaseDocument,
  next: ExtractedPartyDetails[]
): ExtractedCaseDocument {
  const cloned = cloneParties(next);
  if (doc.निवेदक_पक्ष === "प्रतिवादी") {
    return { ...doc, वादी_विवरण: next, विपक्षी_विवरण: cloned };
  }
  return { ...doc, वादी_विवरण: next, निवेदक_विवरण: cloned };
}

/** Keep निवेदक/विपक्षी aliases aligned when editing the true प्रतिवादी list. */
export function withDefendantList(
  doc: ExtractedCaseDocument,
  next: ExtractedPartyDetails[]
): ExtractedCaseDocument {
  const cloned = cloneParties(next);
  if (doc.निवेदक_पक्ष === "प्रतिवादी") {
    return { ...doc, प्रतिवादी_विवरण: next, निवेदक_विवरण: cloned };
  }
  return { ...doc, प्रतिवादी_विवरण: next, विपक्षी_विवरण: cloned };
}

export function withNibedakSide(
  doc: ExtractedCaseDocument,
  side: NibedakSide | null
): ExtractedCaseDocument {
  if (side === "प्रतिवादी") {
    return {
      ...doc,
      निवेदक_पक्ष: side,
      निवेदक_विवरण: cloneParties(doc.प्रतिवादी_विवरण),
      विपक्षी_विवरण: cloneParties(doc.वादी_विवरण),
    };
  }
  return {
    ...doc,
    निवेदक_पक्ष: side,
    निवेदक_विवरण: cloneParties(doc.वादी_विवरण),
    विपक्षी_विवरण: cloneParties(doc.प्रतिवादी_विवरण),
  };
}
