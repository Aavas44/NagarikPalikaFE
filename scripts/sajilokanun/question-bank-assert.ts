/**
 * Run advocate-mode RAG against question.txt and assert expected दफा citations.
 *
 * Usage:
 *   npx tsx scripts/question-bank-assert.ts
 *   npx tsx scripts/question-bank-assert.ts --limit 5
 *   npx tsx scripts/question-bank-assert.ts --failed --skip-scoped
 *   npx tsx scripts/question-bank-assert.ts --questions 1,10,15 --skip-scoped
 *   npx tsx scripts/question-bank-assert.ts --book auto
 */
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { filenameMatchesScope, LAW_BOOKS } from "../../src/lib/sajilokanun/lawbooks";
import { toArabicDigits } from "../../src/lib/sajilokanun/nepali-digits";
import { prepareAdvocateChat } from "./handy-chat";

config({ path: ".env.local" });

const BASE_URL = process.env.HANDYLAW_BASE_URL ?? "http://localhost:3000";
const QUESTION_FILE = join(process.cwd(), "question.txt");
const OUT_DIR = join(process.cwd(), "benchmark");
const OUT_MD = join(OUT_DIR, "question-bank-findings.md");
const OUT_JSON = join(OUT_DIR, "question-bank-results.json");
const OUT_PROCESS = join(OUT_DIR, "question-bank-process-feedback.md");

const BOOK_NAME_TO_SLUG: Record<string, string> = {
  "मुलुकी अपराध संहिता": "criminal-code",
  "मुलुकी फौजदारी कार्यविधि संहिता": "criminal-procedure",
  "मुलुकी देवानी संहिता": "civil-code",
  "मुलुकी देवानी कार्यविधि संहिता": "civil-procedure",
  "मुलुकी देवानी कार्यविधि (संहिता)": "civil-procedure",
};

const BOOK_FILES: Record<string, string> = {
  "criminal-code": "Lawfiles/lawComission/मुलुकी अपराध संहिता, २०७४.txt",
  "criminal-procedure":
    "Lawfiles/lawComission/मुलुकी फौजदारी कार्यविधि संहिता, २०७४.txt",
  "civil-code": "Lawfiles/lawComission/मुलुकी देवानी संहिता, २०७४.txt",
  "civil-procedure":
    "Lawfiles/lawComission/मुलुकी देवानी कार्यविधि (संहिता), २०७४.txt",
};

type ParsedQuestion = {
  num: number;
  batch: number;
  localNum: number;
  question: string;
  bookName: string;
  bookSlug: string;
  dafaNums: string[];
  /** Expected उपदफा when question.txt specifies e.g. "१८ को उपदफा ११". */
  expectedUpadafa: string | null;
  dafaRaw: string;
};

type SsePayload = {
  type: string;
  token?: string;
  sources?: {
    filename: string;
    section_label?: string | null;
    content?: string;
  }[];
  chatMode?: string;
  retrievalMode?: string;
};

type RunResult = {
  bookScope: string;
  passed: boolean;
  failures: string[];
  chatMode?: string;
  retrievalMode?: string;
  sources: string[];
  answerPreview: string;
  citedDafaInAnswer: string[];
  citedDafaInSources: string[];
  citedUpadafaInAnswer: boolean;
  durationMs: number;
  /** True when /api/sajilokanun/chat returned a streamed answer (final user-visible output). */
  chatReached: boolean;
  normalizeOk?: boolean;
};

type QuestionResult = {
  num: number;
  batch?: number;
  localNum?: number;
  question: string;
  expectedBook: string;
  expectedDafa: string[];
  expectedUpadafa?: string | null;
  bookVerified: boolean;
  bookVerifyNote: string;
  runs: RunResult[];
  passed: boolean;
  failureCategory?: string;
};

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseExpectedDafaNums(dafaRaw: string): string[] {
  const upadafaMatch = dafaRaw.match(
    /^([\d०-९]+)\s*को\s*उपदफा\s*([\d०-९]+)/u
  );
  if (upadafaMatch) {
    return [upadafaMatch[1]];
  }
  return dafaRaw
    .split(/\s+र\s+/)
    .map((part) => part.trim())
    .map((part) => {
      const m = part.match(/^([\d०-९]+)/u);
      return m ? m[1] : part;
    })
    .filter(Boolean);
}

function parseExpectedUpadafa(dafaRaw: string): string | null {
  const m = dafaRaw.match(/^([\d०-९]+)\s*को\s*उपदफा\s*([\d०-९]+)/u);
  return m ? m[2] : null;
}

function parseQuestions(raw: string): ParsedQuestion[] {
  const out: ParsedQuestion[] = [];
  const lineRe =
    /^([\d०-९]+)\.\s+(.+?)\s*->\s*\(([^,]+),\s*दफा\s*([^)]+)\)\s*$/u;

  let batch = 1;
  let seq = 0;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const m = trimmed.match(lineRe);
    if (!m) continue;

    seq += 1;
    const localNum = Number(toArabicDigits(m[1]));
    if (localNum === 1 && seq > 1) {
      batch += 1;
    }
    const question = m[2].trim();
    const bookName = m[3].trim();
    const dafaRaw = m[4].trim();
    const bookSlug = BOOK_NAME_TO_SLUG[bookName];
    if (!bookSlug) {
      throw new Error(`Unknown book name: ${bookName} (Q${seq})`);
    }

    const dafaNums = parseExpectedDafaNums(dafaRaw);
    const expectedUpadafa = parseExpectedUpadafa(dafaRaw);

    out.push({
      num: seq,
      batch,
      localNum,
      question,
      bookName,
      bookSlug,
      dafaNums,
      expectedUpadafa,
      dafaRaw,
    });
  }

  return out;
}

function dafaExistsInBook(bookSlug: string, dafaNepali: string): boolean {
  const file = join(process.cwd(), BOOK_FILES[bookSlug]);
  const content = readFileSync(file, "utf8");
  const arabic = toArabicDigits(dafaNepali);
  const patterns = [
    new RegExp(`(?:^|\\n)${dafaNepali}\\.`, "m"),
    new RegExp(`(?:^|\\n)${arabic}\\.`, "m"),
    new RegExp(`(?:^|\\n)${dafaNepali}\\s+[^\\d०-९]`, "m"),
    new RegExp(`(?:^|\\n)${arabic}\\s+[^\\d०-९]`, "m"),
    new RegExp(`[^\\d०-९]${dafaNepali}\\.\\s+`, "u"),
    new RegExp(`[^\\d०-९]${arabic}\\.\\s+`, "u"),
    new RegExp(`दफा\\s*:\\s*${dafaNepali}`, "u"),
    new RegExp(`दफा\\s*:\\s*${arabic}`, "u"),
    new RegExp(`दफा\\s+${dafaNepali}\\s`, "u"),
  ];
  return patterns.some((re) => re.test(content));
}

function verifyBookRefs(q: ParsedQuestion): { ok: boolean; note: string } {
  const missing: string[] = [];
  for (const dafa of q.dafaNums) {
    if (!dafaExistsInBook(q.bookSlug, dafa)) {
      missing.push(dafa);
    }
  }
  if (missing.length === 0) {
    return { ok: true, note: "all expected दफा found in book file" };
  }
  return {
    ok: false,
    note: `missing in ${BOOK_FILES[q.bookSlug]}: ${missing.join(", ")}`,
  };
}

function citesUpadafaInAnswer(
  answer: string,
  dafa: string,
  upadafa: string
): boolean {
  const dArabic = toArabicDigits(dafa);
  const uArabic = toArabicDigits(upadafa);
  const patterns = [
    new RegExp(
      `दफा\\s*[:\\s]*${dafa}[^\\n]{0,48}उपदफा\\s*[\\(（]?\\s*${upadafa}`,
      "u"
    ),
    new RegExp(
      `दफा\\s*[:\\s]*${dArabic}[^\\n]{0,48}उपदफा\\s*[\\(（]?\\s*${uArabic}`,
      "u"
    ),
    new RegExp(`उपदफा\\s*[\\(（]?\\s*${upadafa}`, "u"),
    new RegExp(`उपदफा\\s*[\\(（]?\\s*${uArabic}`, "u"),
    new RegExp(`\\(${upadafa}\\)`, "u"),
    new RegExp(`\\(${uArabic}\\)`, "u"),
  ];
  return patterns.some((re) => re.test(answer));
}

function citesUpadafaInSources(
  sources: { filename: string; section_label?: string | null; content?: string }[],
  bookSlug: string,
  dafa: string,
  upadafa: string
): boolean {
  const uArabic = toArabicDigits(upadafa);
  return sources.some(
    (s) =>
      filenameMatchesScope(s.filename, bookSlug) &&
      typeof s.content === "string" &&
      (s.content.includes(`(${upadafa})`) ||
        s.content.includes(`(${uArabic})`))
  );
}

function citesDafaInAnswer(answer: string, dafaNums: string[]): string[] {
  const found: string[] = [];
  for (const dafa of dafaNums) {
    const arabic = toArabicDigits(dafa);
    if (
      new RegExp(`दफा\\s*[:\\s]*${dafa}`, "u").test(answer) ||
      new RegExp(`दफा\\s*[:\\s]*${arabic}`, "u").test(answer)
    ) {
      found.push(dafa);
    }
  }
  return found;
}

function citesDafaInSources(
  sources: { filename: string; section_label?: string | null }[],
  bookSlug: string,
  dafaNums: string[]
): string[] {
  const found: string[] = [];
  for (const dafa of dafaNums) {
    const arabic = toArabicDigits(dafa);
    const hit = sources.some(
      (s) =>
        filenameMatchesScope(s.filename, bookSlug) &&
        (s.section_label === dafa ||
          s.section_label === arabic ||
          new RegExp(`^${arabic}$`).test(s.section_label ?? "") ||
          new RegExp(dafa).test(s.section_label ?? ""))
    );
    if (hit) found.push(dafa);
  }
  return found;
}

async function fetchAdvocateAnswer(message: string, book: string) {
  const started = Date.now();
  let normalizeOk: boolean | undefined;

  try {
    const prep = await prepareAdvocateChat(BASE_URL, message);
    normalizeOk = prep.normalizeOk;

    const res = await fetch(`${BASE_URL}/api/sajilokanun/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prep.message,
        originalQuestion: prep.originalQuestion,
        book,
        answerMode: "advocate",
        metadataHint: prep.metadataHint,
        searchKeywords: prep.searchKeywords,
      }),
    });

    if (!res.ok) {
      throw new Error(`Chat HTTP ${res.status}: ${await res.text()}`);
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

    return {
      answer,
      tail,
      durationMs: Date.now() - started,
      normalizeOk,
      chatReached: true,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const chatReached = !msg.includes("Normalize HTTP");
    throw Object.assign(new Error(msg), { normalizeOk, chatReached });
  }
}

function evaluateRun(
  q: ParsedQuestion,
  bookScope: string,
  answer: string,
  tail: SsePayload | null,
  durationMs: number
): RunResult {
  const failures: string[] = [];
  const sources = tail?.sources ?? [];

  if (tail?.chatMode !== "advocate") {
    failures.push(`chatMode: expected advocate, got ${tail?.chatMode ?? "none"}`);
  }

  const inAnswer = citesDafaInAnswer(answer, q.dafaNums);
  const inSources = citesDafaInSources(sources, q.bookSlug, q.dafaNums);

  for (const dafa of q.dafaNums) {
    const cited = inAnswer.includes(dafa) || inSources.includes(dafa);
    if (!cited) {
      failures.push(`expected दफा ${dafa} not in answer or sources`);
    }
  }

  let citedUpadafaInAnswer = false;
  if (q.expectedUpadafa && q.dafaNums.length === 1) {
    const dafa = q.dafaNums[0];
    citedUpadafaInAnswer =
      citesUpadafaInAnswer(answer, dafa, q.expectedUpadafa) ||
      citesUpadafaInSources(sources, q.bookSlug, dafa, q.expectedUpadafa);
    if (!citedUpadafaInAnswer) {
      failures.push(
        `expected दफा ${dafa} उपदफा ${q.expectedUpadafa} not in answer or sources`
      );
    }
  }

  const wrongBookSources = sources.filter(
    (s) => !filenameMatchesScope(s.filename, q.bookSlug)
  );
  if (sources.length > 0 && wrongBookSources.length === sources.length) {
    failures.push(
      `no sources from expected book (${q.bookName}); got: ${sources
        .map((s) => s.filename.split("/").pop())
        .join(", ")}`
    );
  }

  if (sources.length === 0) {
    failures.push("no sources returned");
  }

  return {
    bookScope,
    passed: failures.length === 0,
    failures,
    chatMode: tail?.chatMode,
    retrievalMode: tail?.retrievalMode,
    sources: sources.map(
      (s) => `${s.filename.split("/").pop() ?? s.filename} · दफा ${s.section_label ?? "?"}`
    ),
    answerPreview: answer.slice(0, 280).replace(/\s+/g, " "),
    citedDafaInAnswer: inAnswer,
    citedDafaInSources: inSources,
    citedUpadafaInAnswer,
    durationMs,
    chatReached: true,
  };
}

function chatStats(results: QuestionResult[]) {
  let chatReached = 0;
  let normalizeOk = 0;
  let normalizeBlocked = 0;
  for (const r of results) {
    const auto = r.runs.find((x) => x.bookScope === "auto") ?? r.runs[0];
    if (!auto) continue;
    if (auto.chatReached) chatReached += 1;
    else normalizeBlocked += 1;
    if (auto.normalizeOk) normalizeOk += 1;
  }
  const finalWins = results.filter((r) => r.passed).length;
  return { chatReached, normalizeBlocked, normalizeOk, finalWins };
}

function categorizeFailure(r: QuestionResult): string {
  if (!r.bookVerified) return "book_key_error";
  const auto = r.runs.find((x) => x.bookScope === "auto") ?? r.runs[0];
  if (!auto) return "unknown";
  if (auto.chatReached === false) return "normalize_blocked_chat";
  if (auto.failures.some((f) => f.startsWith("HTTP 500"))) return "empty_retrieval";
  if (auto.failures.some((f) => f.includes("no sources from expected book")))
    return "wrong_book";
  if (auto.failures.some((f) => f === "no sources returned")) return "empty_retrieval";
  if (auto.citedDafaInSources.length > 0 && auto.citedDafaInAnswer.length === 0)
    return "sources_ok_answer_missing_citation";
  const earlySource = auto.sources.some((s) =>
    /· दफा [1-9]$|· दफा १[०-]?$/.test(s)
  );
  if (earlySource) return "intro_or_early_section_trap";
  return "wrong_section_retrieval";
}

function getAutoRun(r: QuestionResult): RunResult | undefined {
  return r.runs.find((x) => x.bookScope === "auto") ?? r.runs[0];
}

function retrievedDafaFromSources(sources: string[]): string[] {
  return sources
    .map((s) => {
      const m = s.match(/· दफा ([^\s]+)/);
      return m ? m[1] : null;
    })
    .filter((x): x is string => !!x);
}

function buildProcessFeedback(
  results: QuestionResult[],
  startedAt: string
): string {
  const ragResults = results.filter((r) => r.bookVerified);
  const passed = results.filter((r) => r.passed).length;
  const bookOk = results.filter((r) => r.bookVerified).length;
  const failedRag = ragResults.filter((x) => !x.passed);

  const byCategory = new Map<string, QuestionResult[]>();
  for (const r of failedRag) {
    const cat = r.failureCategory ?? categorizeFailure(r);
    const list = byCategory.get(cat) ?? [];
    list.push(r);
    byCategory.set(cat, list);
  }

  const batch1 = results.filter((r) => (r.batch ?? 1) === 1);
  const batch2 = results.filter((r) => r.batch === 2);
  const batch1Pass = batch1.filter((r) => r.passed).length;
  const batch2Pass = batch2.filter((r) => r.passed).length;
  const stats = chatStats(results);

  const byBook = new Map<string, { total: number; pass: number }>();
  for (const r of ragResults) {
    const slug = BOOK_NAME_TO_SLUG[r.expectedBook] ?? r.expectedBook;
    const cur = byBook.get(slug) ?? { total: 0, pass: 0 };
    cur.total += 1;
    if (r.passed) cur.pass += 1;
    byBook.set(slug, cur);
  }

  const introTrapCount = (byCategory.get("intro_or_early_section_trap") ?? []).length;
  const wrongBookCount = (byCategory.get("wrong_book") ?? []).length;
  const wrongSectionCount = (byCategory.get("wrong_section_retrieval") ?? []).length;

  const lines: string[] = [
    "# Question bank — process feedback (fix the pipeline, not individual Qs)",
    "",
    `Generated: ${startedAt}`,
    "",
    "## North star",
    "",
    "The 120 questions in `question.txt` are a **calibration set**, not a list of strings to memorize.",
    "Success means: a user asks *any* Nepali/English legal question in advocate mode (`book: auto`) and gets a",
    "helpful answer grounded in the **correct act** and **correct substantive दफा**, with sources to match.",
    "",
    "Do **not** close gaps by adding regex rows to `question-topic-pins.ts` — that only helps known test phrases.",
    "",
    "## Run summary",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Total questions | ${results.length} |`,
    `| Answer keys verified in book files | ${bookOk}/${results.length} |`,
    `| **Final chat wins** (/api/sajilokanun/chat output) | **${stats.finalWins}/${results.length}** (${Math.round((stats.finalWins / results.length) * 100)}%) |`,
    `| Chat reached | ${stats.chatReached}/${results.length} |`,
    `| Normalize blocked (Latin query, no chat) | ${stats.normalizeBlocked} |`,
    `| Batch 1 (original 60) | ${batch1Pass}/${batch1.length} |`,
    `| Batch 2 (new 60) | ${batch2Pass}/${batch2.length} |`,
    "",
    "**Calibration signal:** Batch 1 and batch 2 ask similar topics with different wording.",
    `Gap of **${batch1Pass - batch2Pass}** passes (${batch1Pass} vs ${batch2Pass}) indicates phrase-specific routing, not topic understanding.`,
    "",
    "## Pass rate by book (auto mode)",
    "",
    "| Book | Pass |",
    "|------|------|",
  ];

  for (const book of LAW_BOOKS) {
    const stats = byBook.get(book.id);
    if (!stats) continue;
    lines.push(`| ${book.title} | ${stats.pass}/${stats.total} |`);
  }

  lines.push(
    "",
    "## Failure categories",
    "",
    "Each category maps to a **pipeline stage** to fix once — not 120 one-off patches.",
    ""
  );

  const categoryLabels: Record<string, string> = {
    book_key_error: "Bad answer key in question.txt",
    empty_retrieval: "Empty retrieval / HTTP 500",
    wrong_book: "Wrong act retrieved (cross-book homonym)",
    intro_or_early_section_trap: "Introductory दफा १–९ trap",
    sources_ok_answer_missing_citation: "Retrieval OK, LLM omitted citation",
    wrong_section_retrieval: "Right act, wrong substantive दफा",
    unknown: "Uncategorized",
  };

  const categoryFixes: Record<string, string> = {
    book_key_error: "Fix `question.txt` keys in CI (`--verify-books-only`), not RAG.",
    empty_retrieval: "Query normalization + fallback title search when vector returns nothing.",
    wrong_book: "`preferredAct` from LLM analysis + drop sources from non-hinted acts.",
    intro_or_early_section_trap: "Extend `dropIntroductoryDefinitionNoise`; reject early दफा when hints target higher sections.",
    sources_ok_answer_missing_citation: "Advocate prompt: must cite retrieved `section_label` in answer.",
    wrong_section_retrieval: "LLM `sectionHints` as primary router + provision-title search fallback.",
    unknown: "Investigate with query analysis logs.",
  };

  for (const [cat, label] of Object.entries(categoryLabels)) {
    if (cat === "book_key_error") {
      const bookFails = results.filter((r) => !r.bookVerified);
      lines.push(`### ${label} (${bookFails.length})`);
      lines.push(`→ ${categoryFixes[cat]}`);
      if (bookFails.length === 0) lines.push("None.");
      else {
        for (const r of bookFails) {
          lines.push(`- Q${r.num}: ${r.bookVerifyNote}`);
        }
      }
    } else {
      const items = byCategory.get(cat) ?? [];
      lines.push(`### ${label} (${items.length})`);
      lines.push(`→ ${categoryFixes[cat]}`);
      if (items.length === 0) {
        lines.push("None.");
      } else {
        lines.push(`Affected: Q${items.map((r) => r.num).join(", Q")}`);
        const exemplars = items.slice(0, 3);
        for (const r of exemplars) {
          const run = getAutoRun(r);
          const got = run ? retrievedDafaFromSources(run.sources).slice(0, 3) : [];
          lines.push(
            `- Example Q${r.num}: expected **${r.expectedDafa.join(", ")}** in ${r.expectedBook.split(",")[0]}; got sources दफा ${got.join(", ") || "?"}`
          );
        }
        if (items.length > 3) {
          lines.push(`- …and ${items.length - 3} more with same pattern`);
        }
      }
    }
    lines.push("");
  }

  lines.push(
    "## Systemic work items (priority order)",
    "",
    "Implement these so **unseen** questions benefit — the 120-Q set only measures progress.",
    "",
    "| # | Change | Est. impact | Files |",
    "|---|--------|-------------|-------|",
    `| 1 | LLM \`analyzeQuery\` always runs; pins only *merge* hints | Fixes batch-2 gap, reduces wrong-section | \`query-analysis.ts\`, \`fast-query-analysis.ts\`, shrink \`question-topic-pins.ts\` |`,
    `| 2 | Mandatory provision-title search when vector hits दफा ≤१५ or low similarity | ~${introTrapCount + Math.floor(wrongSectionCount * 0.3)} failures | \`retrieve.ts\`, \`provision-title-search.ts\`, \`rag.ts\` |`,
    `| 3 | Cross-book filter: when \`preferredAct\` set, drop other-act chunks | ~${wrongBookCount} failures | \`rag.ts\`, \`legal-retrieval-boost.ts\` |`,
    `| 4 | Extend \`dropIntroductoryDefinitionNoise\` using analysis sectionHints | ~${introTrapCount} failures | \`legal-retrieval-boost.ts\` |`,
    "| 5 | Sub-provision chunks (स्पष्टीकरण / उपदफा) in hierarchical retrieval | Sub-section questions | `hierarchical-section.ts`, chunk labels |",
    "| 6 | Advocate prompt: cite दफा from sources; refuse if no substantive hit | Citation + precision | `advocacy-prompts.ts`, `rag.ts` |",
    "| 7 | CI: `--verify-books-only` on every `question.txt` change | Prevents bad keys | `question-bank-assert.ts` |",
    "",
    "## Definition of done (generalizable system)",
    "",
    "- [ ] Batch 2 pass rate within 10 pts of batch 1 (wording should not matter much)",
    "- [ ] ≥90% pass on 120-Q calibration set with `book: auto`",
    "- [ ] Zero reliance on `question-topic-pins.ts` for routing (file removed or test-only)",
    "- [ ] Wrong-book rate < 2% on calibration set",
    "- [ ] Intro दफा (१–९) appears in sources < 5% when expected दफा > 20",
    "- [ ] Manual spot-check: 10 ad-hoc questions not in `question.txt` all return correct act + substantive दफा",
    "",
    "## What we should stop doing",
    "",
    "- Adding one-off regex entries to `question-topic-pins.ts` per failed benchmark question.",
    "- Treating scoped-book pass as sufficient (users query with `book: auto`).",
    "- Fixing individual answer text without checking whether **sources** had the right दफा.",
    "- Chasing 100% on batch 1 while batch 2 stays near zero — that means we memorized phrases.",
    "",
    "## Re-run commands",
    "",
    "```bash",
    "npx tsx scripts/question-bank-assert.ts --verify-books-only",
    "npx tsx scripts/question-bank-assert.ts --skip-scoped",
    "```",
    ""
  );

  return lines.join("\n");
}

function buildMarkdown(
  results: QuestionResult[],
  startedAt: string,
  bookScopes: string[]
): string {
  const passed = results.filter((r) => r.passed).length;
  const bookOk = results.filter((r) => r.bookVerified).length;
  const failed = results.filter((r) => !r.passed);
  const stats = chatStats(results);

  const byBookSlug = new Map<string, QuestionResult[]>();
  for (const r of results) {
    const slug = BOOK_NAME_TO_SLUG[r.expectedBook] ?? r.expectedBook;
    const list = byBookSlug.get(slug) ?? [];
    list.push(r);
    byBookSlug.set(slug, list);
  }

  const lines: string[] = [
    "# Question bank — advocate mode findings",
    "",
    `Generated: ${startedAt}`,
    `Questions: **${results.length}** | Book refs OK: **${bookOk}/${results.length}**`,
    `**Final chat wins** (correct दफा in /api/sajilokanun/chat answer or sources): **${stats.finalWins}/${results.length}** (${Math.round((stats.finalWins / results.length) * 100)}%)`,
    `Chat reached: **${stats.chatReached}/${results.length}** | Normalize blocked (no chat): **${stats.normalizeBlocked}** | Normalize OK: **${stats.normalizeOk}**`,
    `Book scopes tested per question: ${bookScopes.join(", ")}`,
    "",
    `> **Process fixes (not per-question pins):** see [question-bank-process-feedback.md](./question-bank-process-feedback.md)`,
    "",
    "## Summary by book",
    "",
    "| Book | Questions | Book file OK | RAG pass (auto) | Scoped helps |",
    "|------|-----------|--------------|-----------------|--------------|",
  ];

  for (const book of LAW_BOOKS) {
    const items = byBookSlug.get(book.id) ?? [];
    if (items.length === 0) continue;
    const ragPass = items.filter((r) => r.passed).length;
    const refsOk = items.filter((r) => r.bookVerified).length;
    const scopedHelps = items.filter((r) => {
      const auto = r.runs.find((x) => x.bookScope === "auto");
      const scoped = r.runs.find((x) => x.bookScope === book.id);
      return !auto?.passed && !!scoped?.passed;
    }).length;
    lines.push(
      `| ${book.title} | ${items.length} | ${refsOk}/${items.length} | ${ragPass}/${items.length} | ${scopedHelps} |`
    );
  }

  const passedItems = results.filter((r) => r.passed);
  lines.push("", "## Passed (auto mode)", "");
  if (passedItems.length === 0) {
    lines.push("None.");
  } else {
    for (const r of passedItems) {
      const auto = r.runs.find((x) => x.bookScope === "auto");
      lines.push(
        `- **Q${r.num}** · ${r.expectedBook} दफा ${r.expectedDafa.join(", ")} — ${r.question.slice(0, 70)}…`
      );
      if (auto?.sources.length) {
        lines.push(`  - Sources: ${auto.sources.slice(0, 3).join("; ")}`);
      }
    }
  }

  const bookRefFails = results.filter((r) => !r.bookVerified);
  if (bookRefFails.length > 0) {
    lines.push("", "## Book reference mismatches (question.txt vs law file)", "");
    for (const r of bookRefFails) {
      lines.push(`- **Q${r.num}** expected दफा ${r.expectedDafa.join(", ")} — ${r.bookVerifyNote}`);
    }
  }

  lines.push("", "## Failure patterns", "");
  const http500 = results.filter((r) =>
    r.runs.some((x) => x.failures.some((f) => f.startsWith("HTTP 500")))
  );
  const wrongBook = results.filter((r) =>
    r.runs.some((x) => x.failures.some((f) => f.includes("no sources from expected book")))
  );
  const earlyDafa = results.filter((r) =>
    r.runs.some((x) =>
      x.sources.some((s) => /दफा [1-9]$|दफा [1-9] ·/.test(s) || /· दफा [1-9]$/.test(s))
    )
  );
  lines.push(`- **HTTP 500 (empty retrieval):** ${http500.length} questions — Q${http500.map((r) => r.num).join(", ")}`);
  lines.push(`- **Wrong book retrieved:** ${wrongBook.length} questions — Q${wrongBook.map((r) => r.num).join(", ")}`);
  lines.push(`- **Early दफा (१–९) instead of target:** ${earlyDafa.length} questions`);

  const byBook = new Map<string, QuestionResult[]>();
  for (const r of results) {
    const list = byBook.get(r.expectedBook) ?? [];
    list.push(r);
    byBook.set(r.expectedBook, list);
  }

  lines.push("", "## Failed questions (fix backlog)", "");

  if (failed.length === 0) {
    lines.push("All questions passed.");
  } else {
    for (const r of failed) {
      lines.push(`### Q${r.num}. ${r.question.slice(0, 80)}…`);
      lines.push("");
      lines.push(
        `- **Expected:** ${r.expectedBook} · दफा ${r.expectedDafa.join(", ")}`
      );
      lines.push(`- **Book file:** ${r.bookVerified ? "OK" : r.bookVerifyNote}`);
      for (const run of r.runs.filter((x) => !x.passed)) {
        lines.push(`- **${run.bookScope}:** ${run.failures.join("; ")}`);
        if (run.sources.length > 0) {
          lines.push(`  - Sources: ${run.sources.slice(0, 5).join("; ")}`);
        }
        lines.push(`  - Preview: ${run.answerPreview.slice(0, 200)}…`);
      }
      lines.push("");
    }
  }

  lines.push("", "## Full results", "", "| # | Question | Expected दफा | Book OK | RAG | Scope results |");
  lines.push("|---|----------|--------------|---------|-----|---------------|");

  for (const r of results) {
    const scopeSummary = r.runs
      .map((run) => `${run.bookScope}:${run.passed ? "✓" : "✗"}`)
      .join(" ");
    lines.push(
      `| ${r.num} | ${r.question.slice(0, 50).replace(/\|/g, "/")}… | ${r.expectedDafa.join(", ")} | ${r.bookVerified ? "✓" : "✗"} | ${r.passed ? "✓" : "✗"} | ${scopeSummary} |`
    );
  }

  lines.push(
    "",
    "## How to re-run",
    "",
    "```bash",
    "npx tsx scripts/question-bank-assert.ts",
    "npx tsx scripts/question-bank-assert.ts --limit 10",
    "npx tsx scripts/question-bank-assert.ts --book auto",
    "npx tsx scripts/question-bank-assert.ts --regenerate",
    "```",
    ""
  );

  return lines.join("\n");
}

function parseQuestionNums(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

function loadFailedQuestionNums(): number[] {
  try {
    const saved = JSON.parse(readFileSync(OUT_JSON, "utf8")) as {
      results: QuestionResult[];
    };
    return saved.results.filter((r) => !r.passed).map((r) => r.num);
  } catch {
    return [];
  }
}

function mergeQuestionResults(
  previous: QuestionResult[],
  updated: QuestionResult[]
): QuestionResult[] {
  const byNum = new Map(previous.map((r) => [r.num, r]));
  for (const r of updated) {
    byNum.set(r.num, r);
  }
  return [...byNum.values()].sort((a, b) => a.num - b.num);
}

async function main() {
  const limit = getArg("limit") ? Number(getArg("limit")) : null;
  const onlyBook = getArg("book");
  const skipScoped = hasFlag("skip-scoped");
  const regenerate = hasFlag("regenerate");
  const verifyBooksOnly = hasFlag("verify-books-only");
  const rerunFailed = hasFlag("failed");
  const questionsArg = getArg("questions");
  const mergeResults = hasFlag("merge") || rerunFailed;

  if (regenerate) {
    const saved = JSON.parse(readFileSync(OUT_JSON, "utf8")) as {
      startedAt: string;
      results: QuestionResult[];
      bookScopes?: string[];
    };
    const bookScopes = saved.bookScopes ?? ["auto", "scoped"];
    const results = saved.results.map((r) => {
      const slug = BOOK_NAME_TO_SLUG[r.expectedBook];
      if (!slug) return r;
      const verify = {
        ok: r.expectedDafa.every((d) => dafaExistsInBook(slug, d)),
        note: "",
      };
      if (!verify.ok) {
        const missing = r.expectedDafa.filter((d) => !dafaExistsInBook(slug, d));
        verify.note = `missing in ${BOOK_FILES[slug]}: ${missing.join(", ")}`;
      } else {
        verify.note = "all expected दफा found in book file";
      }
      return {
        ...r,
        bookVerified: verify.ok,
        bookVerifyNote: verify.note,
        passed: verify.ok && (r.runs.find((x) => x.bookScope === "auto")?.passed ?? false),
      };
    });
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      OUT_MD,
      buildMarkdown(results, saved.startedAt, bookScopes)
    );
    writeFileSync(OUT_JSON, JSON.stringify({ ...saved, results }, null, 2));
    console.log(`Regenerated ${OUT_MD}`);
    return;
  }

  const raw = readFileSync(QUESTION_FILE, "utf8");
  let questions = parseQuestions(raw);

  let filterNums: number[] | null = null;
  if (rerunFailed) {
    filterNums = loadFailedQuestionNums();
    if (filterNums.length === 0) {
      console.error("No failed questions in question-bank-results.json");
      process.exit(1);
    }
    console.log(`Re-running ${filterNums.length} previously failed questions`);
  } else if (questionsArg) {
    filterNums = parseQuestionNums(questionsArg);
    console.log(`Re-running ${filterNums.length} selected questions`);
  }

  if (filterNums) {
    const set = new Set(filterNums);
    questions = questions.filter((q) => set.has(q.num));
    if (questions.length === 0) {
      console.error("No matching questions for filter");
      process.exit(1);
    }
  } else if (limit !== null && !Number.isNaN(limit)) {
    questions = questions.slice(0, limit);
  }

  let previousResults: QuestionResult[] = [];
  if (mergeResults) {
    try {
      const saved = JSON.parse(readFileSync(OUT_JSON, "utf8")) as {
        results: QuestionResult[];
      };
      previousResults = saved.results;
    } catch {
      /* first run */
    }
  }

  console.log(`Loaded ${questions.length} questions from question.txt`);
  console.log(
    `Batches: ${questions.filter((q) => q.batch === 1).length} + ${questions.filter((q) => q.batch === 2).length}`
  );

  if (verifyBooksOnly) {
    const startedAt = new Date().toISOString();
    const results: QuestionResult[] = questions.map((q) => {
      const verify = verifyBookRefs(q);
      return {
        num: q.num,
        batch: q.batch,
        localNum: q.localNum,
        question: q.question,
        expectedBook: q.bookName,
        expectedDafa: q.dafaNums,
        expectedUpadafa: q.expectedUpadafa,
        bookVerified: verify.ok,
        bookVerifyNote: verify.note,
        runs: [],
        passed: false,
        failureCategory: verify.ok ? undefined : "book_key_error",
      };
    });
    mkdirSync(OUT_DIR, { recursive: true });
    const bookOk = results.filter((r) => r.bookVerified).length;
    const verifyMd = [
      "# Question bank — book reference verification",
      "",
      `Generated: ${startedAt}`,
      `Book refs OK: **${bookOk}/${results.length}**`,
      "",
      ...results.filter((r) => !r.bookVerified).map(
        (r) => `- **Q${r.num}** — ${r.bookVerifyNote}`
      ),
      results.every((r) => r.bookVerified) ? "All answer keys found in book files." : "",
      "",
    ].join("\n");
    writeFileSync(join(OUT_DIR, "question-bank-book-verify.md"), verifyMd);
    console.log(`Book verify: ${bookOk}/${results.length} OK`);
    console.log(`Report: ${join(OUT_DIR, "question-bank-book-verify.md")}`);
    if (bookOk < results.length) process.exit(1);
    return;
  }

  const bookScopes = onlyBook
    ? [onlyBook]
    : skipScoped
      ? ["auto"]
      : ["auto", "scoped"];

  const startedAt = new Date().toISOString();
  const results: QuestionResult[] = [];

  for (const q of questions) {
    const verify = verifyBookRefs(q);
    console.log(
      `\n=== Q${q.num} [${q.bookSlug}] ${q.question.slice(0, 55)}… ===`
    );
    console.log(`Book ref: ${verify.ok ? "OK" : verify.note}`);

    const runs: RunResult[] = [];

    for (const scope of bookScopes) {
      const bookParam = scope === "scoped" ? q.bookSlug : "auto";
      process.stdout.write(`  ${bookParam}… `);
      try {
        const { answer, tail, durationMs, normalizeOk } = await fetchAdvocateAnswer(
          q.question,
          bookParam
        );
        const run = evaluateRun(q, bookParam, answer, tail, durationMs);
        runs.push({ ...run, normalizeOk, chatReached: true });
        console.log(run.passed ? "PASS" : `FAIL (${run.failures[0]})`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const normalizeOk = (error as { normalizeOk?: boolean }).normalizeOk;
        const chatReached = (error as { chatReached?: boolean }).chatReached ?? false;
        runs.push({
          bookScope: bookParam,
          passed: false,
          failures: [msg],
          sources: [],
          answerPreview: "",
          citedDafaInAnswer: [],
          citedDafaInSources: [],
          citedUpadafaInAnswer: false,
          durationMs: 0,
          chatReached,
          normalizeOk,
        });
        console.log(chatReached ? `FAIL (chat): ${msg.slice(0, 80)}` : `NO CHAT: ${msg.slice(0, 80)}`);
      }
    }

    const passed =
      bookScopes.length === 1
        ? runs.every((r) => r.passed)
        : runs.find((r) => r.bookScope === "auto")?.passed ?? false;

    results.push({
      num: q.num,
      batch: q.batch,
      localNum: q.localNum,
      question: q.question,
      expectedBook: q.bookName,
      expectedDafa: q.dafaNums,
      expectedUpadafa: q.expectedUpadafa,
      bookVerified: verify.ok,
      bookVerifyNote: verify.note,
      runs,
      passed: passed && verify.ok,
      failureCategory: categorizeFailure({
        num: q.num,
        question: q.question,
        expectedBook: q.bookName,
        expectedDafa: q.dafaNums,
        expectedUpadafa: q.expectedUpadafa,
        bookVerified: verify.ok,
        bookVerifyNote: verify.note,
        runs,
        passed: passed && verify.ok,
      }),
    });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const finalResults = mergeResults
    ? mergeQuestionResults(previousResults, results)
    : results;
  writeFileSync(
    OUT_JSON,
    JSON.stringify({ startedAt, bookScopes, results: finalResults }, null, 2)
  );
  writeFileSync(OUT_MD, buildMarkdown(finalResults, startedAt, bookScopes));
  writeFileSync(OUT_PROCESS, buildProcessFeedback(finalResults, startedAt));

  const passed = finalResults.filter((r) => r.passed).length;
  const failed = finalResults.length - passed;
  const stats = chatStats(finalResults);
  const subsetPassed = results.filter((r) => r.passed).length;

  console.log(`\n---`);
  console.log(
    `Final chat wins: ${stats.finalWins}/${finalResults.length} (${Math.round((stats.finalWins / finalResults.length) * 100)}%)`
  );
  console.log(
    `Chat reached: ${stats.chatReached}/${finalResults.length} | Normalize blocked: ${stats.normalizeBlocked}`
  );
  if (filterNums) {
    console.log(
      `Subset: ${subsetPassed}/${results.length} passed (${results.length - subsetPassed} still failing)`
    );
    console.log(`Full bank: ${passed}/${finalResults.length} passed, ${failed} failed`);
  } else {
    console.log(`Done: ${passed}/${finalResults.length} passed, ${failed} failed`);
  }
  console.log(`Report: ${OUT_MD}`);
  console.log(`JSON: ${OUT_JSON}`);
  console.log(`Process feedback: ${OUT_PROCESS}`);

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
