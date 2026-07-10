/**
 * Assert advocate-mode API answers for scenario-style legal questions.
 *
 * Usage:
 *   npx tsx scripts/assert-advocate.ts
 *   npx tsx scripts/assert-advocate.ts --message "..." --book auto
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const BASE_URL = process.env.HANDYLAW_BASE_URL ?? "http://localhost:3000";

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1];
}

type Case = {
  message: string;
  book: string;
  extra: (answer: string, tail: SsePayload | null) => void;
};

const CASES: Case[] = [
  {
    message:
      "विवाह गर्नका लागि कानुनले तोकेको उमेर कति हो र बालविवाह गरेमा कस्तो सजाय हुने व्यवस्था छ?",
    book: "auto",
    extra(answer, tail) {
      assert(tail?.chatMode === "advocate", `expected advocate, got ${tail?.chatMode}`);
      assert(/बीस वर्ष|२० वर्ष/.test(answer), "answer missing बीस वर्ष marriage age");
      assert(
        /बीस वर्ष नपुगी|उमेर बीस वर्ष नपुगी/.test(answer),
        "answer must cite दफा १७३ (१) — बीस वर्ष नपुगी"
      );
      assert(/तीन वर्ष/.test(answer), "answer missing तीन वर्ष कैद");
      assert(/तीस हजार/.test(answer), "answer missing तीस हजार जरिबाना");
      assert(/देवानी संहिता/.test(answer), "answer missing देवानी संहिता citation");
      assert(/अपराध संहिता/.test(answer), "answer missing अपराध संहिता citation");
      assert(/दफा\s*७०|दफा ७०/.test(answer), "answer missing दफा ७०");
      assert(/दफा\s*१७३|दफा १७३/.test(answer), "answer missing दफा १७३");
      assert(
        !/उमेर.*तोकिएको छैन|उमेर निर्धारण छैन|उमेर.*निर्दिष्ट छैन|कुनै विशेष प्रावधान प्रस्तुत गरिएको छैन/.test(
          answer
        ),
        "answer wrongly denies marriage age rule"
      );

      const sources = tail?.sources ?? [];
      assert(sources.length >= 2, "expected >= 2 sources");
      assert(
        sources.some((s) => /देवानी संहिता/.test(s.filename) && /70|७०/.test(s.section_label ?? "")),
        "sources must include civil-code दफा ७०"
      );
      assert(
        sources.some((s) => /अपराध संहिता/.test(s.filename) && /173|१७३/.test(s.section_label ?? "")),
        "sources must include criminal-code दफा १७३"
      );
    },
  },
  {
    message:
      "कुनै पनि करार कानुनी रूपमा मान्य हुनका लागि पूरा गर्नुपर्ने आवश्यक सर्तहरू के-के हुन्?",
    book: "auto",
    extra(answer, tail) {
      assert(tail?.chatMode === "advocate", `expected advocate, got ${tail?.chatMode}`);
      assert(/देवानी संहिता/.test(answer), "answer missing देवानी संहिता citation");
      assert(/दफा\s*५०५|दफा ५०५/.test(answer), "answer missing दफा ५०५");
      assert(/दफा\s*५१७|दफा ५१७/.test(answer), "answer missing दफा ५१७");
      assert(/सहमति/.test(answer), "answer missing सहमति condition");
      assert(/सक्षमता|योग्यता/.test(answer), "answer missing capacity condition");
      assert(/निश्चित विषय/.test(answer), "answer missing definite subject condition");
      assert(/कानूनसम्मत दायित्व/.test(answer), "answer missing lawful object condition");
      assert(/बदर हुने करार|मान्य नहुने करार/.test(answer), "answer missing दफा ५१७ void-contract rule");
      assert(
        /देहाय बमोजिमका करार बदर|बदर हुनेछ/.test(answer),
        "answer missing दफा ५१७ उपदफा (२) intro"
      );
      assert(
        /कानूनको विरुद्धमा|अनैतिक उद्देश्य|गैरकानूनी उद्देश्य|अस्पष्ट रहेकोे करार/.test(
          answer
        ),
        "answer missing दफा ५१७ (२) void-contract categories"
      );

      const sources = tail?.sources ?? [];
      assert(sources.length >= 2, "expected >= 2 sources");
      assert(
        sources.some((s) => /देवानी संहिता/.test(s.filename) && /505|५०५/.test(s.section_label ?? "")),
        "sources must include civil-code दफा ५०५"
      );
      assert(
        sources.some((s) => /देवानी संहिता/.test(s.filename) && /517|५१७/.test(s.section_label ?? "")),
        "sources must include civil-code दफा ५१७"
      );
    },
  },
];

type SsePayload = {
  type: string;
  token?: string;
  sources?: { filename: string; section_label?: string | null }[];
  retrievalMode?: string;
  chatMode?: string;
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function fetchAdvocateAnswer(message: string, book: string) {
  const res = await fetch(`${BASE_URL}/api/sajilokanun/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, book, answerMode: "advocate" }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const raw = await res.text();
  let answer = "";
  let tail: SsePayload | null = null;

  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") continue;
    const json = JSON.parse(payload) as SsePayload;
    if (json.type === "token") answer += json.token ?? "";
    if (json.type === "sources") tail = json;
  }

  return { answer, tail };
}

async function main() {
  const messageArg = getArg("message");
  const bookArg = getArg("book") ?? "auto";
  const cases = messageArg
    ? CASES.filter((c) => c.message === messageArg && c.book === bookArg)
    : CASES;

  if (messageArg && cases.length === 0) {
    throw new Error(`No advocate case for message=${messageArg} book=${bookArg}`);
  }

  for (const testCase of cases) {
    console.log(`\n=== ${testCase.message.slice(0, 60)}… ===`);
    const { answer, tail } = await fetchAdvocateAnswer(
      testCase.message,
      testCase.book
    );

    testCase.extra(answer, tail);

    console.log("PASS", {
      chatMode: tail?.chatMode,
      sources: tail?.sources?.map(
        (s) => `${s.filename.split("/").pop()} · ${s.section_label ?? "?"}`
      ),
      preview: answer.slice(0, 140).replace(/\n/g, " "),
    });
  }

  console.log("\nAll advocate assertions passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
