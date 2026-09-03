import type { LegalCaseDocumentKind } from "@/lib/sajilokanun-access";
import {
  buildPratiuttarapatraUserPrompt,
  parsePratiuttarapatraInputs,
  PRATIUTTARAPATRA_SYSTEM_PROMPT,
  type PratiuttarapatraInputs,
} from "./pratiuttarapatra";
import {
  buildNivedanUserPrompt,
  NIVEDAN_SYSTEM_PROMPT,
  parseNivedanInputs,
} from "./nivedan";
import {
  ADHIKRIT_WARISNAMA_SYSTEM_PROMPT,
  buildAdhikritWarisnamaUserPrompt,
  parseAdhikritWarisnamaInputs,
} from "./adhikrit-warisnama";
import {
  SADHARAN_WARISNAMA_SYSTEM_PROMPT,
  buildSadharanWarisnamaUserPrompt,
  parseSadharanWarisnamaInputs,
} from "./sadharan-warisnama";
import {
  buildManjurinamaUserPrompt,
  MANJURINAMA_SYSTEM_PROMPT,
  parseManjurinamaInputs,
} from "./manjurinama";

export type { PratiuttarapatraInputs, PratiuttarAllegationPoint } from "./pratiuttarapatra";
export { parsePratiuttarapatraInputs } from "./pratiuttarapatra";
export type { NivedanInputs, NivedanPetitionType } from "./nivedan";
export {
  emptyNivedanInputs,
  NIVEDAN_PETITION_TYPES,
  parseNivedanInputs,
} from "./nivedan";
export type { AdhikritWarisnamaInputs } from "./adhikrit-warisnama";
export {
  emptyAdhikritWarisnamaInputs,
  parseAdhikritWarisnamaInputs,
} from "./adhikrit-warisnama";
export type { SadharanWarisnamaInputs } from "./sadharan-warisnama";
export {
  emptySadharanWarisnamaInputs,
  parseSadharanWarisnamaInputs,
} from "./sadharan-warisnama";
export type { ManjurinamaInputs } from "./manjurinama";
export { emptyManjurinamaInputs, parseManjurinamaInputs } from "./manjurinama";
export type {
  ExtractedCaseDocument,
  ExtractedPartyDetails,
  ExtractedFamilyTree,
  ExtractedFamilyTreePerson,
} from "./extract-case-document";
export {
  emptyExtractedCaseDocument,
  emptyExtractedDefendant,
  emptyExtractedParty,
  emptyExtractedFamilyTree,
  ensureFamilyTreeFromParties,
  normalizeExtractedCaseDocument,
  normalizeExtractedFamilyTree,
  normalizePartyList,
  plaintiffParties,
  defendantParties,
  mergePartyLists,
  parseExtractedJsonText,
} from "./extract-case-document";

export type DocumentGenerationRequest = {
  kind: LegalCaseDocumentKind;
  inputs: unknown;
};

export type BuiltDocumentPrompt = {
  systemPrompt: string;
  userPrompt: string;
  label: string;
};

export function buildDocumentPrompt(
  kind: LegalCaseDocumentKind,
  inputs: unknown
): BuiltDocumentPrompt | { error: string } {
  if (kind === "pratiuttarapatra") {
    const parsed = parsePratiuttarapatraInputs(inputs);
    if (!parsed) {
      return {
        error:
          "प्रतिउत्तरपत्र requires court name, plaintiff, defendant, case number, and case type.",
      };
    }
    return {
      systemPrompt: PRATIUTTARAPATRA_SYSTEM_PROMPT,
      userPrompt: buildPratiuttarapatraUserPrompt(parsed),
      label: `प्रतिउत्तरपत्र — ${parsed.caseNo}`,
    };
  }

  if (kind === "nivedan_awedan") {
    const parsed = parseNivedanInputs(inputs);
    if (!parsed) {
      return {
        error:
          "निवेदन requires petition type, court name, petitioner name, and case number.",
      };
    }
    return {
      systemPrompt: NIVEDAN_SYSTEM_PROMPT,
      userPrompt: buildNivedanUserPrompt(parsed),
      label: `निवेदन — ${parsed.caseNo}`,
    };
  }

  if (kind === "adhikrit_warisnama") {
    const parsed = parseAdhikritWarisnamaInputs(inputs);
    if (!parsed) {
      return {
        error:
          "अधिकृत वारिसनामा requires principal name, attorney name, and express powers.",
      };
    }
    return {
      systemPrompt: ADHIKRIT_WARISNAMA_SYSTEM_PROMPT,
      userPrompt: buildAdhikritWarisnamaUserPrompt(parsed),
      label: `अधिकृत वारिसनामा — ${parsed.principalName}`,
    };
  }

  if (kind === "sadharan_warisnama") {
    const parsed = parseSadharanWarisnamaInputs(inputs);
    if (!parsed) {
      return {
        error:
          "साधारण वारिसनामा requires principal name, attorney name, and powers.",
      };
    }
    return {
      systemPrompt: SADHARAN_WARISNAMA_SYSTEM_PROMPT,
      userPrompt: buildSadharanWarisnamaUserPrompt(parsed),
      label: `साधारण वारिसनामा — ${parsed.principalName}`,
    };
  }

  if (kind === "manjurinama") {
    const parsed = parseManjurinamaInputs(inputs);
    if (!parsed) {
      return {
        error: "मन्जुरीनामा requires consenter name and the subject of consent.",
      };
    }
    return {
      systemPrompt: MANJURINAMA_SYSTEM_PROMPT,
      userPrompt: buildManjurinamaUserPrompt(parsed),
      label: `मन्जुरीनामा — ${parsed.consenterName}`,
    };
  }

  return {
    error: `AI drafting for "${kind}" is not available yet.`,
  };
}

export function emptyPratiuttarapatraInputs(
  defaults?: Partial<PratiuttarapatraInputs>
): PratiuttarapatraInputs {
  return {
    courtName: defaults?.courtName ?? "",
    plaintiffName: defaults?.plaintiffName ?? "",
    defendantName: defaults?.defendantName ?? "",
    caseType: defaults?.caseType ?? "",
    caseNo: defaults?.caseNo ?? "",
    defendantFullName: defaults?.defendantFullName ?? "",
    defendantParents: defaults?.defendantParents ?? "",
    defendantAddress: defaults?.defendantAddress ?? "",
    defendantAgeId: defaults?.defendantAgeId ?? "",
    allegationPoints: defaults?.allegationPoints ?? [
      { charge: "", defense: "" },
    ],
    legalGrounds: defaults?.legalGrounds ?? "",
    reliefClaimed: defaults?.reliefClaimed ?? "",
    attachedEvidence: defaults?.attachedEvidence ?? "",
    date: defaults?.date,
  };
}
