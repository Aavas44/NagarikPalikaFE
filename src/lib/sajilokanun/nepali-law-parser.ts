import { spawnSync } from "child_process";
import path from "path";
import type { PdfPage } from "./pdf-extract";
import type { IndexingRule } from "./indexing-rules";

export type NepaliLawPythonChunk = {
  chunk_id: string;
  text: string;
  metadata: {
    document_title?: string;
    document_category?: string;
    book_id?: string;
    bhag?: string | null;
    parichhed?: string | null;
    dafa?: string;
    dafa_arabic?: string;
    dafa_title?: string | null;
    upadafa?: string | null;
    khanda?: string | null;
    chunk_type?: string;
    chunk_id?: string;
    references?: Array<{
      section_dafa: string;
      subsection_upadafa?: string | null;
      clause_khanda?: string | null;
      raw?: string;
    }>;
    chapter_hadamyad_dafa?: string | null;
    provision_role?: "hadamyad" | null;
  };
};

const PARSER_SCRIPT = path.join(process.cwd(), "scripts/parse_nepali_law.py");

export function pagesToRawText(pages: PdfPage[]): string {
  return pages.map((page) => `[PAGE:${page.pageNumber}] ${page.text}`).join("\n");
}

export type NepaliLawParseOptions = {
  inputFormat?: "markers" | "indented";
};

export function parseNepaliLawText(
  rawText: string,
  rule: IndexingRule,
  options: NepaliLawParseOptions = {}
): NepaliLawPythonChunk[] {
  const payload = JSON.stringify({
    text: rawText,
    document_title: rule.documentTitle,
    document_category: rule.documentCategory,
    book_id: rule.bookId,
    book_key: rule.id,
    input_format: options.inputFormat ?? "markers",
  });

  const result = spawnSync("python3", [PARSER_SCRIPT, "--json-stdin"], {
    input: payload,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Nepali law parser failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `Nepali law parser exited ${result.status}: ${result.stderr || result.stdout}`
    );
  }

  const parsed = JSON.parse(result.stdout) as { chunks: NepaliLawPythonChunk[] };
  return parsed.chunks ?? [];
}
