/**
 * Assert quote-mode API response for a structured दफा query.
 *
 * Usage:
 *   npx tsx scripts/assert-quote.ts --message "dafa 4" --book criminal-code
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const BASE_URL = process.env.HANDYLAW_BASE_URL ?? "http://localhost:3000";

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1];
}

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

async function fetchQuoteAnswer(
  message: string,
  book: string
): Promise<{ answer: string; meta: SsePayload | null; tail: SsePayload | null }> {
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

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function main() {
  const message = getArg("message") ?? "dafa 4";
  const book = getArg("book") ?? "criminal-code";

  console.log(`POST /api/sajilokanun/chat  message="${message}"  book="${book}"  answerMode=quote`);

  const { answer, meta, tail } = await fetchQuoteAnswer(message, book);

  console.log("\n--- answer ---\n");
  console.log(answer);
  console.log("\n--- meta ---");
  console.log(meta);
  console.log("\n--- tail ---");
  console.log({ retrievalMode: tail?.retrievalMode, chatMode: tail?.chatMode, sources: tail?.sources?.length });

  assert(meta?.originalQuery === message, "originalQuery mismatch");
  assert(meta?.queryUsed === message, "queryUsed should stay structured");
  assert(meta?.translated === false, "structured query should not be translated");
  assert(tail?.chatMode === "verbatim", `expected verbatim, got ${tail?.chatMode}`);
  assert(tail?.retrievalMode === "keyword", `expected keyword, got ${tail?.retrievalMode}`);
  assert(
    tail?.sources?.every((s) => s.filename.includes("अपराध संहिता")) ?? false,
    "sources must be criminal code"
  );

  assert(/दफा\s*:\s*४/.test(answer), "answer metadata must include दफा : ४");
  assert(/सामान्य\s+रुपमा\s+लागू\s+हुने\s+सिद्धान्त/.test(answer), "missing section text");
  assert(/परिच्छेद[–\-]?\s*२,\s*३,\s*४\s+र\s+५/.test(answer), "missing परिच्छेद list");
  assert(/भाग\s*१/.test(answer), "missing भाग १ reference");
  assert(!/पाउने\s+बमोजिम/.test(answer), "garbage पाउने बमोजिम still present");
  assert(!/र\s+र\s+फौजदारी/.test(answer), "double र before फौजदारी");
  assert(
    !/सामान्य\s+रुपमा[\s\S]{0,40}सामान्य\s+रुपमा/.test(answer),
    "duplicate section title in body"
  );

  console.log("\nAll assertions passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
