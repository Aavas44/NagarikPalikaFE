import { LegalAnswer } from "@/components/sajilokanun/LegalAnswer";
import { SourcePanel, type Source } from "@/components/sajilokanun/SourcePanel";
import { SourceTags } from "@/components/sajilokanun/SourceTags";
import type { SourcePdfPreview } from "@/lib/sajilokanun/source-pdf-link";

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Loading">
      <span className="typing-dot h-2 w-2 rounded-full bg-[var(--muted)]" />
      <span className="typing-dot h-2 w-2 rounded-full bg-[var(--muted)]" />
      <span className="typing-dot h-2 w-2 rounded-full bg-[var(--muted)]" />
    </div>
  );
}

type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
  originalQuery?: string;
  queryUsed?: string;
  rewritten?: boolean;
  sources?: Source[];
  isStreaming?: boolean;
  sourcesExpanded: boolean;
  onToggleSources: () => void;
  canRetry?: boolean;
  onRetry?: () => void;
  onOpenPdf: (preview: SourcePdfPreview) => void;
};

export function ChatMessage({
  role,
  content,
  originalQuery,
  queryUsed,
  rewritten,
  sources,
  isStreaming,
  sourcesExpanded,
  onToggleSources,
  canRetry,
  onRetry,
  onOpenPdf,
}: ChatMessageProps) {
  const isUser = role === "user";
  const isError = content.startsWith("Error:");

  const typedText = originalQuery ?? content;
  const hasLatinInUserMessage =
    isUser && (typedText.match(/[A-Za-z]/g) ?? []).length >= 2;
  const showRewritten =
    isUser &&
    Boolean(
      queryUsed &&
        queryUsed !== typedText &&
        (rewritten || hasLatinInUserMessage)
    );
  const displayText =
    isUser && showRewritten && queryUsed ? queryUsed : content;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          isUser
            ? "bg-[var(--primary)] text-white"
            : "border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]"
        }`}
        aria-hidden
      >
        {isUser ? "Y" : "⚖"}
      </div>

      <div className="min-w-0 max-w-[85%] sm:max-w-[78%]">
        <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">
          {isUser ? "You" : "HandyLaw"}
        </p>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "rounded-tr-md bg-[var(--user-bg)]"
              : isError
                ? "rounded-tl-md border border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                : "card rounded-tl-md bg-[var(--assistant-bg)]"
          }`}
        >
          {isUser ? (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap leading-relaxed">{displayText}</p>
              {showRewritten && (
                <p className="border-t border-[var(--border)]/60 pt-2 text-xs leading-relaxed text-[var(--muted)]">
                  <span className="font-medium">You typed:</span> {typedText}
                </p>
              )}
            </div>
          ) : isStreaming && !content ? (
            <TypingIndicator />
          ) : (
            <LegalAnswer content={content} />
          )}
        </div>

        {sources && sources.length > 0 && !isStreaming && (
          <>
            <SourceTags sources={sources} onOpenPdf={onOpenPdf} />
            <SourcePanel
              sources={sources}
              expanded={sourcesExpanded}
              onToggle={onToggleSources}
              onOpenPdf={onOpenPdf}
            />
          </>
        )}

        {canRetry && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]"
            title="Fetch other relevant दफा, excluding provisions already shown"
          >
            Try other दफा
          </button>
        )}
      </div>
    </div>
  );
}
