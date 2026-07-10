import { CIVIL_CODE_INDEXING_RULE } from "./civil-code.rule";
import { CIVIL_PROCEDURE_INDEXING_RULE } from "./civil-procedure.rule";
import { CRIMINAL_CODE_INDEXING_RULE } from "./criminal-code.rule";
import { CRIMINAL_PROCEDURE_INDEXING_RULE } from "./criminal-procedure.rule";
import type { IndexingRule } from "./types";

export const INDEXING_RULES: IndexingRule[] = [
  CIVIL_CODE_INDEXING_RULE,
  CIVIL_PROCEDURE_INDEXING_RULE,
  CRIMINAL_CODE_INDEXING_RULE,
  CRIMINAL_PROCEDURE_INDEXING_RULE,
];

/** All rules whose source lives under Lawfiles/lawComission/ */
export const LAWCOMISSION_INDEXING_RULES: IndexingRule[] = INDEXING_RULES.filter(
  (rule) => rule.sourceText.startsWith("lawComission/")
);

export function getIndexingRuleById(id: string): IndexingRule | null {
  return INDEXING_RULES.find((rule) => rule.id === id) ?? null;
}

export function resolveIndexingRule(filename: string): IndexingRule | null {
  const normalized = filename.replace(/\\/g, "/");
  for (const rule of INDEXING_RULES) {
    if (rule.match.some((pattern) => pattern.test(normalized))) {
      return rule;
    }
    if (
      normalized === rule.sourceText ||
      normalized === rule.ingestFilename ||
      normalized.endsWith(rule.sourceText)
    ) {
      return rule;
    }
  }
  return null;
}
