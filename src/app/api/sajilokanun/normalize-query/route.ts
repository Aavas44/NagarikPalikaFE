import { parseNormalizeBookRequest } from "@/lib/sajilokanun/book-scope";
import {
  getSajiloKanunTokenFromRequest,
  requireSajiloKanunAccessFromRequest,
} from "@/lib/sajilokanun-guard";
import {
  normalizeQueryWithGemini,
  QueryNormalizeError,
} from "@/lib/sajilokanun/query-translate";
import {
  createUsageRequestId,
  persistSajiloKanunUsage,
  setActiveUsageCollector,
  truncateUsageLabel,
  UsageCollector,
} from "@/lib/sajilokanun/token-usage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = requireSajiloKanunAccessFromRequest(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const { bookScope } = parseNormalizeBookRequest(body.book, body.books);

    const collector = new UsageCollector();
    setActiveUsageCollector(collector);
    let result;
    try {
      result = await normalizeQueryWithGemini(message, {
        book: bookScope === "auto" ? undefined : bookScope,
      });
    } finally {
      setActiveUsageCollector(null);
    }

    const token = getSajiloKanunTokenFromRequest(request);
    const usage = await persistSajiloKanunUsage(token, collector.getEntries(), {
      requestId: createUsageRequestId(),
      requestType: "normalize",
      label: truncateUsageLabel(message),
    });

    return Response.json({ ...result, usage: usage ?? undefined });
  } catch (error) {
    if (error instanceof QueryNormalizeError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Normalization failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
