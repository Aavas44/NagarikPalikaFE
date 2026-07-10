/**
 * Assert quote-mode API for दफा / परिच्छेद title searches.
 *
 * Usage:
 *   npx tsx scripts/assert-title-quote.ts
 *   npx tsx scripts/assert-title-quote.ts --message "राष्ट्रपति उपर आक्रमण" --book criminal-code
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
  expectDafa: RegExp;
  minSources: number;
  sourceBook?: string;
  /** Roman/English queries are rewritten before retrieval. */
  allowRewrite?: boolean;
  expectQueryUsed?: RegExp;
  expectTranslated?: boolean;
  extra?: (answer: string) => void;
};

const CASES: Case[] = [
  {
    message: "भलाईका लागि मञ्जुरी लिई गरेको काम कसूर नहुने",
    book: "criminal-code",
    expectDafa: /दफा\s*:\s*१६/,
    minSources: 1,
  },
  {
    message: "फौजदारी न्यायका सामान्य सिद्धान्तहरु",
    book: "criminal-code",
    expectDafa: /दफा\s*:\s*६/,
    minSources: 10,
  },
  {
    message: "राष्ट्रपति उपर आक्रमण गर्न नहुन",
    book: "criminal-code",
    expectDafa: /दफा\s*:\s*५७/,
    minSources: 2,
    extra(answer) {
      assert(/राज्य विरुद्धका कसूर/.test(answer), "missing परिच्छेद name");
      assert(/आक्रमण गर्नु वा गराउनु/.test(answer), "missing उपदफा (३) text");
    },
  },
  {
    message: "राष्ट्रपति उपर आक्रमण",
    book: "criminal-code",
    expectDafa: /दफा\s*:\s*५७/,
    minSources: 2,
    extra(answer) {
      assert(/राज्य विरुद्धका कसूर/.test(answer), "missing परिच्छेद name");
      assert(/ज्यान लिन वा ज्यान लिने उद्योग/.test(answer), "missing उपदफा (१) text");
      assert(/अपहरण गर्नु वा गराउनु/.test(answer), "missing उपदफा (२) text");
      assert(/आक्रमण गर्नु वा गराउनु/.test(answer), "missing उपदफा (३) text");
      assert(/देहाय बमोजिम सजाय हुनेछ/.test(answer), "missing उपदफा (४) text");
      assert(/\(क\)\s+उपदफा \(१\) बमोजिमको कसूर भए जन्मकैद/.test(answer), "missing खण्ड (क)");
      assert(/\(ख\)\s+उपदफा \(२\) बमोजिमको कसूर भए दश वर्ष/.test(answer), "missing खण्ड (ख)");
      assert(/\(ग\)\s+उपदफा \(३\) बमोजिमको कसूर भए पाँच वर्ष/.test(answer), "missing खण्ड (ग)");
      const markers = ["(१)", "(२)", "(३)", "(४)", "(क)", "(ख)", "(ग)"];
      let last = -1;
      for (const marker of markers) {
        const idx = answer.indexOf(marker);
        assert(idx >= 0, `missing ${marker}`);
        assert(idx > last, `${marker} out of order`);
        last = idx;
      }
      assert(!/संसदलाई/.test(answer), "dafa 58 content leaked into answer");
    },
  },
  {
    message: "झुठ्ठा उजुरी दिन नहुने",
    book: "criminal-code",
    expectDafa: /दफा\s*:\s*९८/,
    minSources: 3,
    extra(answer) {
      assert(/सार्वजनिक न्याय विरुद्धका कसूर/.test(answer), "missing परिच्छेद name");
      assert(/क्षति पुर्‍याउने वा हैरानपाउने/.test(answer), "missing उपदफा (१) text");
      assert(/उपदफा \(१\) बमोजिमको कसूर गर्ने वा गराउने/.test(answer), "missing उपदफा (२) text");
      assert(/तर नेपाल सरकारवादी हुने मुद्दाको हकमा/.test(answer), "missing तर exception");
      assert(/उपदफा \(१\) बमोजिमको कसूर बाट पीडित/.test(answer), "missing उपदफा (३) text");
      const idx1 = answer.indexOf("(१)");
      const idx2 = answer.indexOf("(२)");
      const idxTar = answer.indexOf("तर नेपाल");
      const idx3 = answer.indexOf("(३)");
      assert(idx1 >= 0 && idx2 > idx1, "(२) must follow (१)");
      assert(idxTar > idx2, "तर clause must follow (२)");
      assert(idx3 > idxTar, "(३) must follow तर clause");
      assert(!/बदनियतपूर्वक अनुसन्धान/.test(answer), "dafa 99 content leaked");
    },
  },
  {
    message: "बाल विवाह",
    book: "auto",
    expectDafa: /दफा\s*:\s*१७३/,
    minSources: 3,
    sourceBook: "अपराध संहिता",
    extra(answer) {
      assert(/बाल विवाह गर्न नहुने/.test(answer), "missing दफा title");
      assert(/विवाह सम्बन्धी कसूर/.test(answer), "missing परिच्छेद name");
      assert(/बीस वर्ष नपुगी/.test(answer), "missing उपदफा (१) age rule");
      assert(/तीन वर्षसम्म कैद/.test(answer), "missing उपदफा (३) punishment");
      assert(!/धर्मपुत्र/.test(answer), "civil-code दफा १७३ homonym leaked");
      assert(!/सद्दे, कीर्ते/.test(answer), "civil-procedure दफा १७३ homonym leaked");
    },
  },
  {
    message: "मुद्दा मिलापत्र, डिसमिस वा खारेज भएमा गर्ने",
    book: "auto",
    expectDafa: /दफा\s*:\s*८२/,
    minSources: 5,
    sourceBook: "देवानी कार्यविधि",
    extra(answer) {
      assert(/अदालती शुल्क सम्बन्धी व्यवस्था/.test(answer), "missing परिच्छेद name");
      assert(/पच्चीस प्रतिशत/.test(answer), "missing उपदफा (१) text");
      assert(
        /अदालतले उपदफा \(१\) बमोजिम लाग्ने अदालती शुल्क बादी वा पुनरावेदकबाट लिएर मात्र मिलापत्र गर्नु पर्नेछ/.test(
          answer
        ),
        "missing or truncated उपदफा (२) text"
      );
      assert(/कुनै सजाय गरिने छैन/.test(answer), "missing उपदफा (३) text");
      assert(/अदालती शुल्क फिर्ता हुने छैन/.test(answer), "missing उपदफा (४) text");
      assert(/बाँकी अदालती शुल्क असुल उपर गरिनेछ/.test(answer), "missing उपदफा (५) text");
      assert(
        /तर मुद्दा खारेज भएको हकमा फिरादपत्रको लेखाइबाटै दर्ता हुन नसक्ने/.test(answer),
        "missing तर exception"
      );
      assert(/यस परिच्छेद बमोजिम लाग्ने अदालती शुल्क पुनः दाखिल/.test(answer), "missing उपदफा (६) text");
      const markers = ["(१)", "(२)", "(३)", "(४)", "(५)", "तर मुद्दा", "(६)"];
      let last = -1;
      for (const marker of markers) {
        const idx = answer.indexOf(marker);
        assert(idx >= 0, `missing ${marker}`);
        assert(idx > last, `${marker} out of order`);
        last = idx;
      }
      assert(!/\(क\)\s+उपदफा \(१\) बमोजिम/.test(answer), "stray खण्ड (क) from split (२)");
    },
  },
  {
    message:
      "pratibadi le likhit pratuttar patra kati din bhhitra pesh garnu parchha",
    book: "civil-procedure",
    expectDafa: /दफा\s*:\s*१०१/,
    minSources: 1,
    sourceBook: "देवानी कार्यविधि",
    allowRewrite: true,
    expectTranslated: true,
    expectQueryUsed: /प्रतिवादीले लिखित प्रतिउत्तरपत्र/,
    extra(answer) {
      assert(/एक्काइस दिन/.test(answer), "missing एक्काइस दिन deadline");
      assert(/म्याद दिनु पर्ने/.test(answer), "missing दफा title");
    },
  },
];

type SsePayload = {
  type: string;
  token?: string;
  sources?: { filename: string }[];
  retrievalMode?: string;
  chatMode?: string;
  originalQuery?: string;
  queryUsed?: string;
  translated?: boolean;
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function fetchQuoteAnswer(message: string, book: string) {
  const res = await fetch(`${BASE_URL}/api/sajilokanun/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, book, answerMode: "quote" }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const raw = await res.text();
  let answer = "";
  let meta: SsePayload | null = null;
  let tail: SsePayload | null = null;

  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") continue;
    const json = JSON.parse(payload) as SsePayload;
    if (json.type === "query_meta") meta = json;
    if (json.type === "token") answer += json.token ?? "";
    if (json.type === "sources") tail = json;
  }

  return { answer, meta, tail };
}

async function main() {
  const messageArg = getArg("message");
  const bookArg = getArg("book") ?? "criminal-code";
  const cases = messageArg
    ? CASES.filter((c) => c.message === messageArg && c.book === bookArg)
    : CASES;

  if (messageArg && cases.length === 0) {
    cases.push({
      message: messageArg,
      book: bookArg,
      expectDafa: /दफा\s*:\s*[\d०-९]+/,
      minSources: 1,
    });
  }

  for (const testCase of cases) {
    console.log(`\n=== ${testCase.message} ===`);
    const { answer, meta, tail } = await fetchQuoteAnswer(
      testCase.message,
      testCase.book
    );

    assert(meta?.originalQuery === testCase.message, "originalQuery mismatch");
    if (testCase.allowRewrite) {
      assert(
        testCase.expectTranslated === undefined ||
          meta?.translated === testCase.expectTranslated,
        `expected translated=${testCase.expectTranslated}, got ${meta?.translated}`
      );
      if (testCase.expectQueryUsed) {
        assert(
          testCase.expectQueryUsed.test(meta?.queryUsed ?? ""),
          `queryUsed mismatch: ${meta?.queryUsed}`
        );
      }
    } else {
      assert(meta?.queryUsed === testCase.message, "title query should not be rewritten");
      assert(meta?.translated === false, "title query should not be translated");
    }
    assert(tail?.chatMode === "verbatim", `expected verbatim, got ${tail?.chatMode}`);
    assert(tail?.retrievalMode === "keyword", `expected keyword, got ${tail?.retrievalMode}`);
    assert(
      (tail?.sources?.length ?? 0) >= testCase.minSources,
      `expected >= ${testCase.minSources} sources`
    );
    assert(testCase.expectDafa.test(answer), `answer missing expected दफा (${testCase.expectDafa})`);
    const sourceBook = testCase.sourceBook ?? "अपराध संहिता";
    assert(
      tail?.sources?.every((s) => s.filename.includes(sourceBook)) ?? false,
      `sources must be ${sourceBook}`
    );
    testCase.extra?.(answer);

    console.log("PASS", {
      sources: tail?.sources?.length,
      preview: answer.slice(0, 120).replace(/\n/g, " "),
    });
  }

  console.log("\nAll title-search assertions passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
