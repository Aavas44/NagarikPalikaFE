export type AdvocateSectionHeading =
  | "मुद्दा"
  | "लागू प्रावधानहरू"
  | "सारांश";

export type AdvocateSection = {
  heading: AdvocateSectionHeading;
  body: string;
};

const HEADING_RE =
  /^\*\*(मुद्दा|लागू प्रावधानहरू|सारांश)\*\*$/;

/** Split composed advocate answers into ordered sections. */
export function parseAdvocateSections(text: string): AdvocateSection[] | null {
  if (!text.includes("**मुद्दा**")) return null;

  const lines = text.split("\n");
  const sections: AdvocateSection[] = [];
  let currentHeading: AdvocateSectionHeading | null = null;
  let bodyLines: string[] = [];

  function flush() {
    if (!currentHeading) return;
    const body = bodyLines.join("\n").trim();
    sections.push({ heading: currentHeading, body });
    bodyLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(HEADING_RE);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1] as AdvocateSectionHeading;
      continue;
    }
    if (currentHeading) bodyLines.push(line);
  }
  flush();

  return sections.length > 0 ? sections : null;
}
