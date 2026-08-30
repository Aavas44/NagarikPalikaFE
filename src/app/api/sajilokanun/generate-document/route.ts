import { completeChat, resolveDocumentGenerationModel } from "@/lib/sajilokanun/ai";
import { buildDocumentPrompt } from "@/lib/sajilokanun/document-prompts";
import type { LegalCaseDocumentKind } from "@/lib/sajilokanun-access";
import {
  getSajiloKanunTokenFromRequest,
  requireSajiloKanunAccessFromRequest,
} from "@/lib/sajilokanun-guard";
import {
  createUsageRequestId,
  persistSajiloKanunUsage,
  setActiveUsageCollector,
  truncateUsageLabel,
  UsageCollector,
} from "@/lib/sajilokanun/token-usage";

export const runtime = "nodejs";

const DOCUMENT_KINDS = new Set<LegalCaseDocumentKind>([
  "firadpatra",
  "pratiuttarapatra",
  "vakalatnama",
  "warisnama",
  "nivedan_awedan",
  "adhikrit_warisnama",
  "sadharan_warisnama",
  "manjurinama",
]);

function parseKind(value: unknown): LegalCaseDocumentKind | null {
  return typeof value === "string" && DOCUMENT_KINDS.has(value as LegalCaseDocumentKind)
    ? (value as LegalCaseDocumentKind)
    : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const kind = parseKind(body.kind);
    if (!kind) {
      return Response.json({ error: "A valid document kind is required" }, { status: 400 });
    }

    const denied = await requireSajiloKanunAccessFromRequest(request);
    if (denied) return denied;

    const built = buildDocumentPrompt(kind, body.inputs);
    if ("error" in built) {
      return Response.json({ error: built.error }, { status: 400 });
    }

    const model = resolveDocumentGenerationModel();
    const collector = new UsageCollector();
    const requestId = createUsageRequestId();
    setActiveUsageCollector(collector);

    let content: string;
    try {
      content = await completeChat(
        built.systemPrompt,
        built.userPrompt,
        model,
        "narrative"
      );
    } finally {
      setActiveUsageCollector(null);
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return Response.json({ error: "Document generation returned empty content" }, { status: 502 });
    }

    const token = getSajiloKanunTokenFromRequest(request);
    if (token) {
      await persistSajiloKanunUsage(token, collector.getEntries(), {
        requestId,
        requestType: "chat",
        label: truncateUsageLabel(built.label),
      });
    }

    return Response.json({ kind, content: trimmed, model });
  } catch (err) {
    console.error("[generate-document]", err);
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate document",
      },
      { status: 500 }
    );
  }
}
