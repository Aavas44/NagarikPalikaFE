import fs from "fs";
import path from "path";
import type { IngestChunk } from "./pdf-extract";
import { toNepaliNumberDisplay } from "./nepali-digits";
import { cleanNepaliText } from "./text-clean";
import {
  cleanTextWithGemini,
  type GeminiCleanResult,
  type WordChange,
} from "./text-clean-gemini";
import { isQuotaError } from "./gemini";

export type TextCleanProvider = "regex" | "gemini";

export type ChunkCleanRecord = {
  chunkIndex: number;
  sectionLabel: string | null;
  pageNumber: number;
  status: "unchanged" | "cleaned" | "rejected" | "skipped";
  rejectReason?: string;
  wordChanges: WordChange[];
  beforePreview: string;
  afterPreview: string;
};

export type CleanRunSummary = {
  runId: string;
  filename: string;
  startedAt: string;
  finishedAt: string;
  totalChunks: number;
  cleanedCount: number;
  unchangedCount: number;
  rejectedCount: number;
  totalWordChanges: number;
  logDir: string;
};

export function getTextCleanProvider(): TextCleanProvider {
  const provider = process.env.TEXT_CLEAN_PROVIDER ?? "regex";
  return provider === "gemini" ? "gemini" : "regex";
}

export function splitChunkContent(content: string): {
  header: string;
  body: string;
} {
  const newline = content.indexOf("\n");
  if (newline === -1) {
    return { header: "", body: content };
  }
  return {
    header: content.slice(0, newline),
    body: content.slice(newline + 1),
  };
}

export function mergeChunkContent(header: string, body: string): string {
  return header ? `${header}\n${body}` : body;
}

export function normalizeChunkNumerals(content: string): string {
  const { header, body } = splitChunkContent(content);
  const normalizedHeader = header
    .replace(
      /परिच्छेद\s*([\d०-९]+)/g,
      (_, n) => `परिच्छेद ${toNepaliNumberDisplay(n)}`
    )
    .replace(
      /दफा\s+([\d०-९]+(?:\.[\d०-९]+)?)/g,
      (_, n) => `दफा ${toNepaliNumberDisplay(n)}`
    )
    .replace(/p\.([\d०-९]+)/g, (_, n) => `p.${toNepaliNumberDisplay(n)}`);

  const normalizedBody = body.replace(
    /^([\d०-९]+(?:\.[\d०-९]+)?)\./,
    (_, n) => `${toNepaliNumberDisplay(n)}.`
  );

  return mergeChunkContent(normalizedHeader, normalizedBody);
}

function preview(text: string, max = 160): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

export class GeminiChangeLogger {
  private readonly jsonlPath: string;
  private readonly summaryPath: string;
  private records: ChunkCleanRecord[] = [];

  constructor(public readonly runId: string, public readonly filename: string) {
    const logDir = path.join(process.cwd(), "logs", "gemini-cleanup", runId);
    fs.mkdirSync(logDir, { recursive: true });
    this.jsonlPath = path.join(logDir, "changes.jsonl");
    this.summaryPath = path.join(logDir, "summary.md");
  }

  get logDir(): string {
    return path.dirname(this.jsonlPath);
  }

  append(record: ChunkCleanRecord) {
    this.records.push(record);
    fs.appendFileSync(this.jsonlPath, `${JSON.stringify(record)}\n`, "utf8");
  }

  writeSummary(summary: Omit<CleanRunSummary, "logDir">) {
    const lines = [
      `# Gemini word-level cleanup — ${summary.filename}`,
      "",
      `- Run ID: \`${summary.runId}\``,
      `- Started: ${summary.startedAt}`,
      `- Finished: ${summary.finishedAt}`,
      `- Total chunks: ${summary.totalChunks}`,
      `- Cleaned: ${summary.cleanedCount}`,
      `- Unchanged: ${summary.unchangedCount}`,
      `- Rejected (kept original): ${summary.rejectedCount}`,
      `- Total word changes: ${summary.totalWordChanges}`,
      "",
      "## Changes by section",
      "",
    ];

    const withChanges = this.records.filter((r) => r.wordChanges.length > 0);
    if (withChanges.length === 0) {
      lines.push("_No word-level changes recorded._");
    }

    for (const record of withChanges) {
      lines.push(
        `### दफा ${record.sectionLabel ?? "?"} (p.${record.pageNumber}, chunk ${record.chunkIndex})`,
        ""
      );
      if (record.status === "rejected") {
        lines.push(`_Rejected: ${record.rejectReason}_`, "");
      }
      for (const change of record.wordChanges) {
        lines.push(`- \`${change.from}\` → \`${change.to}\` (${change.reason})`);
      }
      lines.push("");
    }

    if (this.records.some((r) => r.status === "rejected")) {
      lines.push("## Rejected (structure would have changed)", "");
      for (const record of this.records.filter((r) => r.status === "rejected")) {
        lines.push(
          `- दफा ${record.sectionLabel ?? "?"} p.${record.pageNumber}: ${record.rejectReason}`
        );
      }
      lines.push("");
    }

    lines.push(
      "## Verify",
      "",
      "Review `changes.jsonl` for full before/after previews per chunk.",
      "Only word-level joins/typos should appear — no sentence rewrites.",
      ""
    );

    fs.writeFileSync(this.summaryPath, lines.join("\n"), "utf8");
  }
}

export async function cleanIngestChunks(
  chunks: IngestChunk[],
  filename: string,
  options?: {
    provider?: TextCleanProvider;
    logger?: GeminiChangeLogger;
    geminiDelayMs?: number;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<{ chunks: IngestChunk[]; summary: CleanRunSummary }> {
  const provider = options?.provider ?? getTextCleanProvider();
  const runId =
    options?.logger?.runId ??
    new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logger = options?.logger ?? new GeminiChangeLogger(runId, filename);
  const startedAt = new Date().toISOString();
  const geminiDelayMs = Number(process.env.GEMINI_CLEAN_DELAY_MS ?? 400);

  let useGemini = provider === "gemini";

  let cleanedCount = 0;
  let unchangedCount = 0;
  let rejectedCount = 0;
  let totalWordChanges = 0;

  const output: IngestChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const { header, body } = splitChunkContent(chunk.content);
    const regexBody = cleanNepaliText(body);

    let finalBody = regexBody;
    let record: ChunkCleanRecord = {
      chunkIndex: i,
      sectionLabel: chunk.sectionLabel,
      pageNumber: chunk.pageNumber,
      status: "unchanged",
      wordChanges: [],
      beforePreview: preview(body),
      afterPreview: preview(regexBody),
    };

    if (useGemini && regexBody.trim()) {
      try {
        const result: GeminiCleanResult = await cleanTextWithGemini(regexBody, {
          sectionLabel: chunk.sectionLabel,
          pageNumber: chunk.pageNumber,
        });

        if (result.rejected) {
          record.status = "rejected";
          record.rejectReason = result.rejectReason;
          rejectedCount++;
          finalBody = regexBody;
        } else if (result.changes.length > 0) {
          record.status = "cleaned";
          record.wordChanges = result.changes;
          record.afterPreview = preview(result.cleaned);
          finalBody = result.cleaned;
          cleanedCount++;
          totalWordChanges += result.changes.length;
        } else {
          unchangedCount++;
        }
      } catch (error) {
        if (isQuotaError(error)) {
          console.warn(
            "  Gemini quota exhausted — using regex cleanup for remaining chunks"
          );
          useGemini = false;
          if (regexBody !== body) {
            record.status = "cleaned";
            cleanedCount++;
          } else {
            unchangedCount++;
          }
          record.afterPreview = preview(regexBody);
        } else {
          throw error;
        }
      }

      if (useGemini && geminiDelayMs > 0 && i + 1 < chunks.length) {
        await new Promise((r) => setTimeout(r, geminiDelayMs));
      }
    } else {
      if (regexBody !== body) {
        record.status = "cleaned";
        cleanedCount++;
      } else {
        unchangedCount++;
      }
      record.afterPreview = preview(regexBody);
    }

    if (provider === "gemini" && useGemini) {
      logger.append(record);
    }

    output.push({
      ...chunk,
      content: normalizeChunkNumerals(mergeChunkContent(header, finalBody)),
    });

    options?.onProgress?.(i + 1, chunks.length);
  }

  const summary: CleanRunSummary = {
    runId: logger.runId,
    filename,
    startedAt,
    finishedAt: new Date().toISOString(),
    totalChunks: chunks.length,
    cleanedCount,
    unchangedCount,
    rejectedCount,
    totalWordChanges,
    logDir: logger.logDir,
  };

  if (provider === "gemini" && useGemini) {
    logger.writeSummary(summary);
  }

  return { chunks: output, summary };
}
