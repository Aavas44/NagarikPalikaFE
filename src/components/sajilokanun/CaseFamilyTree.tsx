"use client";

import { useMemo } from "react";
import type { ExtractedFamilyTree } from "@/lib/sajilokanun/document-prompts/extract-case-document";
import emiStyles from "@/components/user/emi.module.css";
import styles from "./CaseFamilyTree.module.css";

type Labels = {
  title: string;
  empty: string;
  generation: string;
  relation: string;
  sidePlaintiff: string;
  sideDefendant: string;
  sideOther: string;
  sourceNote: string;
};

type Props = {
  tree: ExtractedFamilyTree | null | undefined;
  labels: Labels;
};

function sideClass(side: string | null | undefined): string {
  if (side === "वादी") return styles.sidePlaintiff;
  if (side === "प्रतिवादी") return styles.sideDefendant;
  return styles.sideOther;
}

function sideLabel(side: string | null | undefined, labels: Labels): string {
  if (side === "वादी") return labels.sidePlaintiff;
  if (side === "प्रतिवादी") return labels.sideDefendant;
  if (side === "अन्य") return labels.sideOther;
  return "";
}

export function CaseFamilyTree({ tree, labels }: Props) {
  const generations = useMemo(() => {
    const people = tree?.व्यक्तिहरू ?? [];
    if (people.length === 0) return [];
    const byGen = new Map<number, typeof people>();
    for (const person of people) {
      const gen = typeof person.पुस्ता === "number" ? person.पुस्ता : 0;
      const list = byGen.get(gen) ?? [];
      list.push(person);
      byGen.set(gen, list);
    }
    return [...byGen.entries()].sort((a, b) => a[0] - b[0]);
  }, [tree]);

  if (!tree || tree.व्यक्तिहरू.length === 0) {
    return (
      <div className={emiStyles.emiPanel}>
        <h3 className={emiStyles.emiPanelTitle}>{labels.title}</h3>
        <p className={emiStyles.emiFieldHint}>{labels.empty}</p>
      </div>
    );
  }

  const byId = new Map(tree.व्यक्तिहरू.map((p) => [p.आईडी, p]));

  return (
    <div className={emiStyles.emiPanel}>
      <h3 className={emiStyles.emiPanelTitle}>{labels.title}</h3>
      {tree.स्रोत_टिप्पणी ? (
        <p className={emiStyles.emiFieldHint}>
          {labels.sourceNote}: {tree.स्रोत_टिप्पणी}
        </p>
      ) : null}
      <div className={styles.tree}>
        {generations.map(([gen, people]) => (
          <div key={gen} className={styles.generationRow}>
            <div className={styles.generationLabel}>
              {labels.generation} {gen}
            </div>
            <div className={styles.peopleRow}>
              {people.map((person) => {
                const parents = person.अभिभावक_आईडीहरू
                  .map((id) => byId.get(id)?.नाम)
                  .filter(Boolean);
                const isRoot = tree.मूल_व्यक्ति_आईडी === person.आईडी;
                return (
                  <div
                    key={person.आईडी}
                    className={`${styles.person} ${sideClass(person.पक्ष)} ${
                      isRoot ? styles.root : ""
                    }`}
                  >
                    <div className={styles.personName}>{person.नाम}</div>
                    {person.नाता ? (
                      <div className={styles.personMeta}>
                        {labels.relation}: {person.नाता}
                      </div>
                    ) : null}
                    {person.पक्ष ? (
                      <div className={styles.personBadge}>
                        {sideLabel(person.पक्ष, labels)}
                      </div>
                    ) : null}
                    {parents.length > 0 ? (
                      <div className={styles.personMeta}>
                        ← {parents.join(", ")}
                      </div>
                    ) : null}
                    {person.टिप्पणी ? (
                      <div className={styles.personNote}>{person.टिप्पणी}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
