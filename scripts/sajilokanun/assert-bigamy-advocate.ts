/**
 * Assert advocate-mode bigamy (बहुविवाह) punishment query.
 *
 * Usage:
 *   npx tsx scripts/assert-bigamy-advocate.ts
 */
import { config } from "dotenv";
import { toArabicDigits } from "../../src/lib/sajilokanun/nepali-digits";
import { formatSourceLabel } from "../../src/lib/sajilokanun/source-label";

config({ path: ".env.local" });

const BASE_URL = process.env.HANDYLAW_BASE_URL ?? "http://localhost:3000";

const PAYLOAD = {
  message:
    "बहुविवाहमा संलग्न पुरुष र महिला दुवैलाई कति वर्षसम्म कैद सजाय हुने व्यवस्था छ?",
  originalQuestion:
    "बहुविवाहमा संलग्न पुरुष र महिला दुवैलाई कति वर्षसम्म कैद सजाय हुने व्यवस्था छ?",
  book: "auto",
  answerMode: "advocate",
  metadataHint: {
    act: "Muluki Aparadh Samhita 2074",
    matchingDafaNames: ["१७५. वहुविवाह गर्न नहुने", "४०. सजायका प्रकार:"],
    exactDafaGuess: [175, 40],
  },
  searchKeywords: [
    "बहुविवाह",
    "कैद सजाय",
    "आपराधिक कसूर",
    "विवाह सम्बन्धी कसूर",
  ],
};

type Source = {
  filename: string;
  section_label?: string | null;
  section_title?: string | null;
  chapter?: string | null;
  content?: string;
};

type SsePayload = {
  type: string;
  token?: string;
  sources?: Source[];
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function sectionRootsFromAnswer(answer: string): string[] {
  const roots = new Set<string>();
  const re = /दफा\s*([०-९\d]+)/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(answer)) !== null) {
    roots.add(toArabicDigits(match[1]));
  }
  return [...roots];
}

async function main() {
  const res = await fetch(`${BASE_URL}/api/sajilokanun/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(PAYLOAD),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const raw = await res.text();
  let answer = "";
  let sources: Source[] = [];

  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") continue;
    const json = JSON.parse(payload) as SsePayload;
    if (json.type === "token") answer += json.token ?? "";
    if (json.type === "sources") sources = json.sources ?? [];
  }

  console.log("--- answer (first 1200 chars) ---\n");
  console.log(answer.slice(0, 1200));
  console.log("\n--- sources ---");
  for (const source of sources) {
    console.log(
      `- ${source.filename.split("/").pop()} | दफा ${source.section_label} | ${(source.section_title ?? "").slice(0, 50)}`
    );
  }

  assert(answer.includes("**लागू प्रावधानहरू**"), "missing provisions block");
  assert(/अपराध संहिता/.test(answer), "answer must cite criminal code");
  assert(/वहुविवाह|बहुविवाह/.test(answer), "answer must discuss bigamy");
  assert(/एक वर्षदेखि पाँच वर्ष|१ वर्षदेखि ५ वर्ष/.test(answer), "missing 1–5 year imprisonment");
  assert(!/धर्मपुत्र वा धर्मपुत्री/.test(answer), "wrong civil-code धर्मपुत्र provisions in answer");

  const criminal175 = sources.find(
    (s) =>
      /अपराध संहिता/.test(s.filename) &&
      toArabicDigits(s.section_label ?? "") === "175"
  );
  assert(Boolean(criminal175), "sources must include criminal-code दफा १७५");
  assert(
    /वहुविवाह/.test(criminal175?.section_title ?? ""),
    "दफा १७५ source must be वहुविवाह गर्न नहुने, not another act's homonym"
  );
  const criminal175Label = formatSourceLabel({
    filename: criminal175!.filename,
    section_label: criminal175!.section_label,
    section_title: criminal175!.section_title,
    chapter: criminal175!.chapter,
    content: criminal175!.content,
  });
  assert(
    /विवाह सम्बन्धी कसूर/.test(criminal175Label) &&
      /वहुविवाह/.test(criminal175Label) &&
      /दफा १७५/.test(criminal175Label),
    `source label must include chapter, दफा name, and number — got: ${criminal175Label}`
  );
  assert(
    !sources.some(
      (s) =>
        /फौजदारी कार्यविधि/.test(s.filename) &&
        toArabicDigits(s.section_label ?? "") === "175"
    ),
    "must not attribute दफा १७५ to फौजदारी कार्यविधि"
  );
  assert(
    !sources.some(
      (s) =>
        /देवानी संहिता/.test(s.filename) &&
        ["171", "172", "173", "175"].includes(toArabicDigits(s.section_label ?? ""))
    ),
    "must not include wrong civil-code homonym दफास in sources"
  );

  const citedRoots = sectionRootsFromAnswer(answer);
  const sourceRoots = new Set(
    sources.map((s) => toArabicDigits(s.section_label?.split(".")[0] ?? ""))
  );
  for (const root of citedRoots) {
    if (!sourceRoots.has(root)) {
      console.warn(`Warning: दफा ${root} cited in answer but missing from sources panel`);
    }
  }

  console.log("\nAll bigamy advocate assertions passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
