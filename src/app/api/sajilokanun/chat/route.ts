import { streamAnswer } from "@/lib/sajilokanun/rag";
import { requireSajiloKanunAccessFromRequest } from "@/lib/sajilokanun-guard";
import type { AnswerMode } from "@/lib/sajilokanun/answer-mode";
import { parseBookScope, validateBooksRequest } from "@/lib/sajilokanun/book-scope";
import {
  normalizeQueryForRetrieval,
  QueryNormalizeError,
  type QueryMetadataHint,
} from "@/lib/sajilokanun/query-translate";
import { needsGeminiPreprocess } from "@/lib/sajilokanun/query-latin-detect";
import { parseExcludeDafaList } from "@/lib/sajilokanun/retrieve";

export const runtime = "nodejs";

function quickLocalNormalize(text: string): string {
  return text
    .replace(/\bdafa\b/gi, "दफा")
    .replace(/\bsection\b/gi, "दफा")
    .replace(/\bsec\b/gi, "दफा")
    .replace(/\bupadafa\b/gi, "उपदफा")
    .replace(/\bparichhed\b/gi, "परिच्छेद")
    .replace(/\bbhag\b/gi, "भाग")
    .replace(/\bko\b/gi, "को")
    .replace(/\bma\b/gi, "मा")
    .replace(/\bkhanda\b/gi, "खण्ड")
    .replace(/\bka\b/gi, "क")
    .replace(/\bkha\b/gi, "ख")
    .replace(/\bga\b/gi, "ग");
}

function parseAnswerMode(value: unknown): AnswerMode {
  return value === "advocate" ? "advocate" : "quote";
}

export async function POST(request: Request) {
  const denied = requireSajiloKanunAccessFromRequest(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const originalQuestion =
      typeof body.originalQuestion === "string"
        ? body.originalQuestion.trim()
        : message;
    const metadataHint: QueryMetadataHint | undefined =
      body.metadataHint && typeof body.metadataHint === "object"
        ? body.metadataHint
        : undefined;
    const searchKeywords = Array.isArray(body.searchKeywords)
      ? body.searchKeywords
          .filter((item: unknown): item is string => typeof item === "string")
          .map((item: string) => item.trim())
          .filter(Boolean)
      : undefined;
    const answerMode = parseAnswerMode(body.answerMode);

    const excludeDafas = parseExcludeDafaList(body.excludeDafas);

    if (!message) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    if (answerMode === "advocate" && needsGeminiPreprocess(message)) {
      return Response.json(
        {
          error:
            "Query contains Roman/English text. Call POST /api/normalize-query first.",
        },
        { status: 400 }
      );
    }

    if (body.books !== undefined) {
      const validation = validateBooksRequest(body.books);
      if (!validation.ok) {
        return Response.json({ error: validation.error }, { status: 400 });
      }
    }

    const bookScope = parseBookScope(body.book, body.books);

    const normalizedMessage =
      answerMode === "quote" && needsGeminiPreprocess(message)
        ? quickLocalNormalize(message)
        : message;

    const { originalQuery, queryUsed, translated, rewritten } =
      await normalizeQueryForRetrieval(normalizedMessage);

    const displayOriginal = originalQuestion || originalQuery;

    console.log("[HandyLaw chat request]", {
      message: displayOriginal,
      queryUsed,
      translated,
      rewritten,
      bookScope,
      answerMode,
      metadataHint,
      searchKeywords,
      excludeDafas: excludeDafas.length > 0 ? excludeDafas : undefined,
    });

    const { stream, sources, retrievalMode, chatMode, analysis } =
      await streamAnswer(queryUsed, {
        bookScope,
        answerMode,
        originalQuestion: displayOriginal,
        metadataHint,
        searchKeywords,
        excludeDafas,
      });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "query_meta",
                originalQuery: displayOriginal,
                queryUsed,
                translated,
                rewritten,
              })}\n\n`
            )
          );

          for await (const chunk of stream) {
            const token = chunk.text ?? "";
            if (token) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "token", token })}\n\n`
                )
              );
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "sources",
                sources,
                retrievalMode,
                chatMode,
                analysis: analysis
                  ? {
                      intent: analysis.intent,
                      retrievalQueries: analysis.retrievalQueries,
                    }
                  : undefined,
              })}\n\n`
            )
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Stream failed";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: message })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof QueryNormalizeError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Request failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
