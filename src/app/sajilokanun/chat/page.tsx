"use client";

import { useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/sajilokanun/ChatInput";
import { ChatMessage } from "@/components/sajilokanun/ChatMessage";
import { EmptyState } from "@/components/sajilokanun/EmptyState";
import { SajiloKanunAppShell } from "@/components/sajilokanun/SajiloKanunAppShell";
import shellStyles from "@/components/sajilokanun/SajiloKanunAppShell.module.css";
import emiStyles from "@/components/user/emi.module.css";
import { PdfPreviewPanel } from "@/components/sajilokanun/PdfPreviewPanel";
import { useLanguage } from "@/context/LanguageContext";
import type { Source } from "@/components/sajilokanun/SourcePanel";
import { cleanAnswerDisplay } from "@/lib/sajilokanun/text-clean";
import { type BookScope, LAW_BOOKS } from "@/lib/sajilokanun/lawbooks";
import type { SourcePdfPreview } from "@/lib/sajilokanun/source-pdf-link";
import type { AnswerMode } from "@/lib/sajilokanun/answer-mode";
import { needsGeminiPreprocess } from "@/lib/sajilokanun/query-latin-detect";
import { toArabicDigits } from "@/lib/sajilokanun/nepali-digits";
import { notifyUsageUpdated } from "@/lib/sajilokanun/token-usage";
import type { QueryMetadataHint } from "@/lib/sajilokanun/query-translate";
import {
  fetchSajiloKanunQuota,
  type SajiloKanunDailyQuota,
} from "@/lib/sajilokanun-access";

/** Quick client-side normalization for quote mode — just fix "dafa" → "दफा" etc. */
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

/** Context saved on assistant messages so retry can skip normalize-query. */
type RetryContext = {
  questionId: string;
  chatMessage: string;
  originalQuestion: string;
  book: BookScope;
  answerMode: AnswerMode;
  metadataHint?: QueryMetadataHint;
  searchKeywords?: string[];
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  originalQuery?: string;
  queryUsed?: string;
  rewritten?: boolean;
  sources?: Source[];
  retryContext?: RetryContext;
};

type ChatRequest = RetryContext & {
  excludeDafas?: number[];
};

function extractDafaRootsFromResponse(
  sources?: Source[],
  answer?: string
): number[] {
  const roots = new Set<string>();

  for (const source of sources ?? []) {
    const label = source.section_label?.trim();
    if (!label) continue;
    const root = label.split(".")[0]?.trim();
    if (root && /^[\d०-९]+$/u.test(root)) {
      roots.add(toArabicDigits(root));
    }
  }

  const re = /दफा\s*[:：]?\s*([\d०-९]+)/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(answer ?? "")) !== null) {
    roots.add(toArabicDigits(match[1]));
  }

  return [...roots]
    .map((d) => Number(d))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export default function Home() {
  const { msg } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [bookScope, setBookScope] = useState<BookScope>("auto");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("quote");
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<SourcePdfPreview | null>(null);
  const [dailyQuota, setDailyQuota] =
    useState<SajiloKanunDailyQuota | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    void fetchSajiloKanunQuota()
      .then((result) => setDailyQuota(result.quota))
      .catch(() => undefined);
  }, []);

  async function streamChatResponse(
    assistantId: string,
    userMessageId: string | null,
    request: ChatRequest
  ): Promise<RetryContext> {
    const response = await fetch("/api/sajilokanun/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sajilo-Question-Id": request.questionId,
      },
      body: JSON.stringify({
        message: request.chatMessage,
        originalQuestion: request.originalQuestion,
        book: request.book,
        answerMode: request.answerMode,
        metadataHint: request.metadataHint,
        searchKeywords: request.searchKeywords,
        ...(request.excludeDafas?.length
          ? { excludeDafas: request.excludeDafas }
          : {}),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? "Request failed");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;

        const event = JSON.parse(payload) as
          | { type: "token"; token: string }
          | {
              type: "query_meta";
              originalQuery: string;
              queryUsed: string;
              translated: boolean;
              rewritten: boolean;
            }
          | { type: "sources"; sources: Source[] }
          | { type: "usage" }
          | { type: "error"; error: string };

        if (event.type === "query_meta" && userMessageId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === userMessageId
                ? {
                    ...msg,
                    originalQuery: event.originalQuery,
                    queryUsed: event.queryUsed,
                    rewritten: event.rewritten,
                  }
                : msg
            )
          );
        } else if (event.type === "token") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: msg.content + event.token }
                : msg
            )
          );
        } else if (event.type === "sources") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, sources: event.sources } : msg
            )
          );
        } else if (event.type === "usage") {
          notifyUsageUpdated();
        } else if (event.type === "error") {
          throw new Error(event.error);
        }
      }
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? { ...msg, content: cleanAnswerDisplay(msg.content) }
          : msg
      )
    );
    void fetchSajiloKanunQuota()
      .then((result) => setDailyQuota(result.quota))
      .catch(() => undefined);

    return {
      questionId: request.questionId,
      chatMessage: request.chatMessage,
      originalQuestion: request.originalQuestion,
      book: request.book,
      answerMode: request.answerMode,
      metadataHint: request.metadataHint,
      searchKeywords: request.searchKeywords,
    };
  }

  async function sendQuestion(
    question: string,
    book: BookScope = bookScope,
    mode: AnswerMode = answerMode
  ) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const userMessageId = crypto.randomUUID();
    const userMessage: Message = {
      id: userMessageId,
      role: "user",
      content: trimmed,
    };

    const assistantId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setInput("");
    setLoading(true);
    setStreamingId(assistantId);

    try {
      const originalQuestion = trimmed;
      let chatMessage = trimmed;
      let metadataHint: QueryMetadataHint | undefined;
      let searchKeywords: string[] | undefined;

      if (mode === "advocate") {
        const normalizePayload: {
          message: string;
          book?: string;
          books?: string[];
        } = { message: trimmed };

        if (book === "auto") {
          normalizePayload.books = LAW_BOOKS.map((b) => b.id);
        } else {
          normalizePayload.book = book;
        }

        const normalizeRes = await fetch("/api/sajilokanun/normalize-query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Sajilo-Question-Id": userMessageId,
          },
          body: JSON.stringify(normalizePayload),
        });

        if (normalizeRes.ok) {
          const normalized = (await normalizeRes.json()) as {
            queryUsed: string;
            originalQuery: string;
            rewritten: boolean;
            metadataHint?: QueryMetadataHint;
            searchKeywords?: string[];
          };

          chatMessage = normalized.queryUsed;
          metadataHint = normalized.metadataHint;
          searchKeywords = normalized.searchKeywords;

          if (normalized.rewritten) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === userMessageId
                  ? {
                      ...msg,
                      originalQuery: normalized.originalQuery,
                      queryUsed: normalized.queryUsed,
                      rewritten: normalized.rewritten,
                    }
                  : msg
              )
            );
          }
          notifyUsageUpdated();
        } else if (needsGeminiPreprocess(trimmed)) {
          const data = (await normalizeRes.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to normalize query");
        }
      } else if (needsGeminiPreprocess(trimmed)) {
        chatMessage = quickLocalNormalize(trimmed);
      }

      const retryContext = await streamChatResponse(assistantId, userMessageId, {
        questionId: userMessageId,
        chatMessage,
        originalQuestion,
        book,
        answerMode: mode,
        metadataHint,
        searchKeywords,
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId ? { ...msg, retryContext } : msg
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId ? { ...msg, content: `Error: ${message}` } : msg
        )
      );
    } finally {
      setLoading(false);
      setStreamingId(null);
    }
  }

  async function retryAnswer(assistantId: string) {
    if (loading) return;

    const assistant = messages.find((m) => m.id === assistantId);
    if (!assistant?.retryContext) return;

    const excludeDafas = extractDafaRootsFromResponse(
      assistant.sources,
      assistant.content
    );
    if (excludeDafas.length === 0) return;

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? { ...msg, content: "", sources: undefined }
          : msg
      )
    );
    setExpandedSources(null);
    setLoading(true);
    setStreamingId(assistantId);

    try {
      const retryContext = await streamChatResponse(assistantId, null, {
        ...assistant.retryContext,
        excludeDafas,
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId ? { ...msg, retryContext } : msg
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId ? { ...msg, content: `Error: ${message}` } : msg
        )
      );
    } finally {
      setLoading(false);
      setStreamingId(null);
    }
  }

  function handleExampleSelect(query: string, book: BookScope) {
    setBookScope(book);
    setInput(query);
    void sendQuestion(query, book);
  }

  function handleClearChat() {
    if (loading) return;
    setMessages([]);
    setExpandedSources(null);
    setPdfPreview(null);
  }

  return (
    <SajiloKanunAppShell
      title={msg.sajilokanun.chat}
      subtitle={msg.sajilokanun.subtitle}
      headerAction={
        messages.length > 0
          ? {
              label: "New chat",
              onClick: handleClearChat,
              disabled: loading,
            }
          : null
      }
    >
      {dailyQuota ? (
        <div className={shellStyles.quotaBanner}>
          <strong>
            {dailyQuota.remaining > 0
              ? "1 free query available today"
              : "Today’s free query has been used"}
          </strong>
          <span>
            Resets{" "}
            {new Date(dailyQuota.resetAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      ) : null}
      <div className={`${emiStyles.emiPanel} ${shellStyles.chatPanel}`}>
        <div className={`${shellStyles.chatBody} chat-scroll`}>
          {messages.length === 0 ? (
            <EmptyState
              onSelect={handleExampleSelect}
              disabled={loading || dailyQuota?.remaining === 0}
            />
          ) : (
            <div className={shellStyles.messageStack}>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  originalQuery={message.originalQuery}
                  queryUsed={message.queryUsed}
                  rewritten={message.rewritten}
                  sources={message.sources}
                  isStreaming={message.id === streamingId}
                  sourcesExpanded={expandedSources === message.id}
                  onToggleSources={() =>
                    setExpandedSources(
                      expandedSources === message.id ? null : message.id
                    )
                  }
                  canRetry={
                    message.role === "assistant" &&
                    Boolean(message.retryContext) &&
                    message.id !== streamingId &&
                    !message.content.startsWith("Error:") &&
                    extractDafaRootsFromResponse(
                      message.sources,
                      message.content
                    ).length > 0
                  }
                  onRetry={
                    message.role === "assistant"
                      ? () => void retryAnswer(message.id)
                      : undefined
                  }
                  onOpenPdf={setPdfPreview}
                />
              ))}
            </div>
          )}
          <div ref={bottomRef} className="h-2 shrink-0" />
        </div>

        <div className={shellStyles.chatFooter}>
          <ChatInput
            input={input}
            bookScope={bookScope}
            answerMode={answerMode}
            loading={loading || dailyQuota?.remaining === 0}
            onInputChange={setInput}
            onBookChange={setBookScope}
            onAnswerModeChange={setAnswerMode}
            onSubmit={() => void sendQuestion(input)}
          />
        </div>
      </div>

      {pdfPreview && (
        <PdfPreviewPanel
          src={pdfPreview.src}
          title={pdfPreview.title}
          page={pdfPreview.page}
          onClose={() => setPdfPreview(null)}
        />
      )}
    </SajiloKanunAppShell>
  );
}
