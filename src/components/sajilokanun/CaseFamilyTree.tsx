"use client";

import { useMemo } from "react";
import type { ExtractedFamilyTree, ExtractedFamilyTreePerson } from "@/lib/sajilokanun/document-prompts/extract-case-document";
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

type LaidOutPerson = {
  person: ExtractedFamilyTreePerson;
  x: number;
  y: number;
  gen: number;
};

type FamilyUnit = {
  parentIds: string[];
  childIds: string[];
};

const NODE_W = 152;
const NODE_H = 52;
const H_GAP = 22;
const ROW_H = 126;
const PAD_X = 36;
const PAD_Y = 34;
const CLUSTER_GAP = 48;

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

function inTreeParents(
  person: ExtractedFamilyTreePerson,
  byId: Map<string, ExtractedFamilyTreePerson>
): string[] {
  return person.अभिभावक_आईडीहरू.filter((id) => byId.has(id));
}

function parentKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

function inferGenerations(
  people: ExtractedFamilyTreePerson[],
  byId: Map<string, ExtractedFamilyTreePerson>
): Map<string, number> {
  const gen = new Map<string, number>();
  for (const person of people) {
    if (typeof person.पुस्ता === "number") gen.set(person.आईडी, person.पुस्ता);
  }

  let changed = true;
  let guard = 0;
  while (changed && guard < people.length * 4) {
    changed = false;
    guard += 1;
    for (const person of people) {
      if (!gen.has(person.आईडी)) {
        const parentGens = inTreeParents(person, byId)
          .map((id) => gen.get(id))
          .filter((value): value is number => typeof value === "number");
        if (parentGens.length > 0) {
          gen.set(person.आईडी, Math.max(...parentGens) + 1);
          changed = true;
        }
      }
      const childGen = gen.get(person.आईडी);
      if (childGen === undefined) continue;
      for (const parentId of inTreeParents(person, byId)) {
        if (!gen.has(parentId)) {
          gen.set(parentId, childGen - 1);
          changed = true;
        }
      }
    }
  }

  for (const person of people) {
    if (!gen.has(person.आईडी)) gen.set(person.आईडी, 0);
  }
  return gen;
}

function connectedComponents(
  people: ExtractedFamilyTreePerson[],
  byId: Map<string, ExtractedFamilyTreePerson>
): ExtractedFamilyTreePerson[][] {
  const ids = people.map((person) => person.आईडी);
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  const addEdge = (a: string, b: string) => {
    adj.get(a)?.push(b);
    adj.get(b)?.push(a);
  };
  for (const person of people) {
    for (const parentId of inTreeParents(person, byId)) {
      addEdge(person.आईडी, parentId);
    }
  }

  const seen = new Set<string>();
  const groups: ExtractedFamilyTreePerson[][] = [];
  for (const person of people) {
    if (seen.has(person.आईडी)) continue;
    const queue = [person.आईडी];
    seen.add(person.आईडी);
    const groupIds: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      groupIds.push(id);
      for (const next of adj.get(id) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    groups.push(groupIds.map((id) => byId.get(id)!).filter(Boolean));
  }
  return groups;
}

function childrenOf(
  id: string,
  people: ExtractedFamilyTreePerson[],
  byId: Map<string, ExtractedFamilyTreePerson>
): ExtractedFamilyTreePerson[] {
  return people.filter((person) => inTreeParents(person, byId).includes(id));
}

function spousesOf(
  person: ExtractedFamilyTreePerson,
  people: ExtractedFamilyTreePerson[],
  byId: Map<string, ExtractedFamilyTreePerson>
): ExtractedFamilyTreePerson[] {
  const seen = new Set<string>();
  const partners: ExtractedFamilyTreePerson[] = [];
  for (const child of childrenOf(person.आईडी, people, byId)) {
    for (const parentId of inTreeParents(child, byId)) {
      if (parentId === person.आईडी || seen.has(parentId)) continue;
      const partner = byId.get(parentId);
      if (!partner) continue;
      seen.add(parentId);
      partners.push(partner);
    }
  }
  return partners;
}

function familyUnits(
  people: ExtractedFamilyTreePerson[],
  byId: Map<string, ExtractedFamilyTreePerson>
): FamilyUnit[] {
  const grouped = new Map<string, FamilyUnit>();
  for (const person of people) {
    const parents = inTreeParents(person, byId);
    if (parents.length === 0) continue;
    const key = parentKey(parents);
    const existing = grouped.get(key);
    if (existing) {
      existing.childIds.push(person.आईडी);
    } else {
      grouped.set(key, { parentIds: [...parents].sort(), childIds: [person.आईडी] });
    }
  }
  return [...grouped.values()];
}

function layoutComponent(
  people: ExtractedFamilyTreePerson[],
  byId: Map<string, ExtractedFamilyTreePerson>
): LaidOutPerson[] {
  const gens = inferGenerations(people, byId);
  const minGen = Math.min(...[...gens.values()]);
  const positions = new Map<string, { x: number; y: number }>();

  const byGen = new Map<number, ExtractedFamilyTreePerson[]>();
  for (const person of people) {
    const gen = gens.get(person.आईडी) ?? 0;
    const list = byGen.get(gen) ?? [];
    list.push(person);
    byGen.set(gen, list);
  }

  const sortGeneration = (list: ExtractedFamilyTreePerson[]) => {
    return [...list].sort((a, b) => {
      const aParents = parentKey(inTreeParents(a, byId));
      const bParents = parentKey(inTreeParents(b, byId));
      if (aParents !== bParents) return aParents.localeCompare(bParents);
      const aCouple = parentKey([a.आईडी, ...spousesOf(a, people, byId).map((p) => p.आईडी)]);
      const bCouple = parentKey([b.आईडी, ...spousesOf(b, people, byId).map((p) => p.आईडी)]);
      if (aCouple !== bCouple) return aCouple.localeCompare(bCouple);
      return a.नाम.localeCompare(b.नाम, "ne");
    });
  };

  const generations = [...byGen.keys()].sort((a, b) => a - b);
  const maxGen = Math.max(...generations);
  const yFor = (gen: number) => (gen - minGen) * ROW_H + PAD_Y;

  const clustersInGen = (gen: number): ExtractedFamilyTreePerson[][] => {
    const list = sortGeneration(byGen.get(gen) ?? []);
    const used = new Set<string>();
    const clusters: ExtractedFamilyTreePerson[][] = [];
    for (const person of list) {
      if (used.has(person.आईडी)) continue;
      const cluster = [
        person,
        ...spousesOf(person, people, byId).filter(
          (partner) => gens.get(partner.आईडी) === gen && !used.has(partner.आईडी)
        ),
      ].sort((a, b) => a.नाम.localeCompare(b.नाम, "ne"));
      cluster.forEach((member) => used.add(member.आईडी));
      clusters.push(cluster);
    }
    return clusters;
  };

  const clusterWidth = (cluster: ExtractedFamilyTreePerson[]) =>
    cluster.length * NODE_W + (cluster.length - 1) * H_GAP;

  const placeCluster = (cluster: ExtractedFamilyTreePerson[], start: number, gen: number) => {
    cluster.forEach((member, index) => {
      positions.set(member.आईडी, {
        x: start + index * (NODE_W + H_GAP),
        y: yFor(gen),
      });
    });
  };

  const uncollideGen = (gen: number) => {
    const clusters = clustersInGen(gen).sort((a, b) => {
      const ax =
        a.reduce((sum, p) => sum + (positions.get(p.आईडी)?.x ?? 0), 0) / a.length;
      const bx =
        b.reduce((sum, p) => sum + (positions.get(p.आईडी)?.x ?? 0), 0) / b.length;
      if (ax !== bx) return ax - bx;
      return a[0].नाम.localeCompare(b[0].नाम, "ne");
    });
    let left = 0;
    for (const cluster of clusters) {
      const width = clusterWidth(cluster);
      const current = Math.min(
        ...cluster.map((member) => positions.get(member.आईडी)?.x ?? left)
      );
      const start = Math.max(current, left);
      placeCluster(cluster, start, gen);
      left = start + width + H_GAP;
    }
  };

  // Youngest generation: pack sibling groups left to right.
  {
    const youngest = sortGeneration(byGen.get(maxGen) ?? []);
    const siblingGroups = new Map<string, ExtractedFamilyTreePerson[]>();
    for (const person of youngest) {
      const key = parentKey(inTreeParents(person, byId)) || person.आईडी;
      const list = siblingGroups.get(key) ?? [];
      list.push(person);
      siblingGroups.set(key, list);
    }
    let x = 0;
    for (const group of siblingGroups.values()) {
      for (const person of group) {
        positions.set(person.आईडी, { x, y: yFor(maxGen) });
        x += NODE_W + H_GAP;
      }
      x += H_GAP;
    }
    uncollideGen(maxGen);
  }

  // Older generations: sit each couple above its children, then resolve overlaps.
  for (let gen = maxGen - 1; gen >= minGen; gen -= 1) {
    for (const cluster of clustersInGen(gen)) {
      const childXs: number[] = [];
      for (const member of cluster) {
        for (const child of childrenOf(member.आईडी, people, byId)) {
          const childPos = positions.get(child.आईडी);
          if (!childPos) continue;
          childXs.push(childPos.x + NODE_W / 2);
        }
      }
      const width = clusterWidth(cluster);
      const center =
        childXs.length > 0
          ? childXs.reduce((sum, value) => sum + value, 0) / childXs.length
          : width / 2;
      placeCluster(cluster, center - width / 2, gen);
    }
    uncollideGen(gen);
  }

  const minX = Math.min(...[...positions.values()].map((pos) => pos.x));
  for (const pos of positions.values()) {
    pos.x -= minX;
  }

  return people.map((person) => {
    const pos = positions.get(person.आईडी)!;
    return {
      person,
      x: pos.x,
      y: pos.y,
      gen: gens.get(person.आईडी) ?? 0,
    };
  });
}

function layoutTree(people: ExtractedFamilyTreePerson[]): LaidOutPerson[] {
  const byId = new Map(people.map((person) => [person.आईडी, person]));
  const components = connectedComponents(people, byId);
  const laidOut: LaidOutPerson[] = [];
  let offsetX = 0;
  for (const component of components) {
    const nodes = layoutComponent(component, byId);
    const width = Math.max(...nodes.map((node) => node.x + NODE_W), NODE_W);
    for (const node of nodes) {
      laidOut.push({ ...node, x: node.x + offsetX + PAD_X });
    }
    offsetX += width + CLUSTER_GAP;
  }
  return laidOut;
}

function connectorPaths(
  people: ExtractedFamilyTreePerson[],
  nodes: LaidOutPerson[]
): string[] {
  const byId = new Map(people.map((person) => [person.आईडी, person]));
  const pos = new Map(nodes.map((node) => [node.person.आईडी, node]));
  const paths: string[] = [];

  for (const family of familyUnits(people, byId)) {
    const parents = family.parentIds
      .map((id) => pos.get(id))
      .filter((node): node is LaidOutPerson => Boolean(node));
    const children = family.childIds
      .map((id) => pos.get(id))
      .filter((node): node is LaidOutPerson => Boolean(node));
    if (parents.length === 0 || children.length === 0) continue;

    const parentBottom = Math.max(...parents.map((node) => node.y + NODE_H));
    const childTop = Math.min(...children.map((node) => node.y));
    const marryY = parentBottom + 12;
    const joinY = parentBottom + (childTop - parentBottom) * 0.55;
    const parentXs = parents.map((node) => node.x + NODE_W / 2);
    const childXs = children.map((node) => node.x + NODE_W / 2);
    const dropX =
      parentXs.reduce((sum, value) => sum + value, 0) / parentXs.length;

    if (parents.length >= 2) {
      const minPx = Math.min(...parentXs);
      const maxPx = Math.max(...parentXs);
      for (const parent of parents) {
        const px = parent.x + NODE_W / 2;
        paths.push(`M ${px} ${parent.y + NODE_H} V ${marryY}`);
      }
      paths.push(`M ${minPx} ${marryY} H ${maxPx}`);
      paths.push(`M ${dropX} ${marryY} V ${joinY}`);
    } else {
      paths.push(`M ${dropX} ${parents[0].y + NODE_H} V ${joinY}`);
    }

    const minCx = Math.min(...childXs);
    const maxCx = Math.max(...childXs);
    paths.push(`M ${Math.min(dropX, minCx)} ${joinY} H ${Math.max(dropX, maxCx)}`);
    for (const child of children) {
      const cx = child.x + NODE_W / 2;
      paths.push(`M ${cx} ${joinY} V ${child.y}`);
    }
  }

  return paths;
}

export function CaseFamilyTree({ tree, labels }: Props) {
  const people = tree?.व्यक्तिहरू ?? [];
  const layout = useMemo(() => {
    const list = tree?.व्यक्तिहरू ?? [];
    if (list.length === 0) return [];
    return layoutTree(list);
  }, [tree]);

  const paths = useMemo(
    () => (layout.length === 0 ? [] : connectorPaths(people, layout)),
    [people, layout]
  );

  const chartWidth = useMemo(() => {
    if (layout.length === 0) return 720;
    const maxX = Math.max(...layout.map((node) => node.x + NODE_W));
    return Math.max(maxX + PAD_X, 640);
  }, [layout]);

  const chartHeight = useMemo(() => {
    if (layout.length === 0) return 280;
    const maxY = Math.max(...layout.map((node) => node.y + NODE_H));
    return Math.max(maxY + PAD_Y + 16, 260);
  }, [layout]);

  const byId = new Map(people.map((person) => [person.आईडी, person]));

  if (!tree || people.length === 0) {
    return (
      <div className={emiStyles.emiPanel}>
        <h3 className={emiStyles.emiPanelTitle}>{labels.title}</h3>
        <div className={styles.viewport}>
          <div className={styles.chart} style={{ width: "100%", minHeight: 240 }}>
            <p className={styles.emptyMessage}>{labels.empty}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={emiStyles.emiPanel}>
      <h3 className={emiStyles.emiPanelTitle}>{labels.title}</h3>
      {tree.स्रोत_टिप्पणी ? (
        <p className={emiStyles.emiFieldHint}>
          {labels.sourceNote}: {tree.स्रोत_टिप्पणी}
        </p>
      ) : null}
      <div className={styles.viewport}>
        <div
          className={styles.chart}
          style={{ minHeight: chartHeight }}
        >
          <div
            className={styles.plot}
            style={{ width: chartWidth, height: chartHeight }}
          >
          <svg
            className={styles.connectors}
            width={chartWidth}
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            aria-hidden="true"
          >
            {paths.map((d, index) => (
              <path key={index} d={d} />
            ))}
          </svg>
          {layout.map((node) => {
            const person = node.person;
            const parents = inTreeParents(person, byId)
              .map((id) => byId.get(id)?.नाम)
              .filter(Boolean);
            const isRoot = tree.मूल_व्यक्ति_आईडी === person.आईडी;
            const party = sideLabel(person.पक्ष, labels);
            return (
              <div
                key={person.आईडी}
                className={`${styles.person} ${sideClass(person.पक्ष)} ${
                  isRoot ? styles.root : ""
                }`}
                tabIndex={0}
                style={{
                  left: node.x,
                  top: node.y,
                  width: NODE_W,
                  height: NODE_H,
                }}
                title={[
                  person.नाम,
                  person.नाता ? `${labels.relation}: ${person.नाता}` : "",
                  party,
                  parents.length ? parents.join(", ") : "",
                  person.टिप्पणी ?? "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <div className={styles.personName}>{person.नाम}</div>
                {person.नाता ? (
                  <div className={styles.personMeta}>{person.नाता}</div>
                ) : null}
                <div className={styles.tooltip}>
                  {party ? <div>{party}</div> : null}
                  {person.नाता ? (
                    <div>
                      {labels.relation}: {person.नाता}
                    </div>
                  ) : null}
                  {parents.length > 0 ? <div>← {parents.join(", ")}</div> : null}
                  {person.टिप्पणी ? (
                    <div className={styles.tooltipNote}>{person.टिप्पणी}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
      <div className={styles.legend}>
        <span className={`${styles.legendItem} ${styles.sidePlaintiff}`}>
          {labels.sidePlaintiff}
        </span>
        <span className={`${styles.legendItem} ${styles.sideDefendant}`}>
          {labels.sideDefendant}
        </span>
        <span className={`${styles.legendItem} ${styles.sideOther}`}>
          {labels.sideOther}
        </span>
      </div>
    </div>
  );
}
