import { parseNormalizeBookRequest } from "@/lib/sajilokanun/book-scope";
import { requireSajiloKanunAccessFromRequest } from "@/lib/sajilokanun-guard";
import {
  normalizeQueryWithGemini,
  QueryNormalizeError,
} from "@/lib/sajilokanun/query-translate";

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

    const result = await normalizeQueryWithGemini(message, {
      book: bookScope === "auto" ? undefined : bookScope,
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof QueryNormalizeError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Normalization failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
