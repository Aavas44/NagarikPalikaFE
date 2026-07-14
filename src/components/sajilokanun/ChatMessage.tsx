import { LegalAnswer } from "@/components/sajilokanun/LegalAnswer";
import { SourcePanel, type Source } from "@/components/sajilokanun/SourcePanel";
import { SourceTags } from "@/components/sajilokanun/SourceTags";
import type { SourcePdfPreview } from "@/lib/sajilokanun/source-pdf-link";
import styles from "./ChatMessage.module.css";

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1" aria-label="Loading">
      <span className="typing-dot h-2.5 w-2.5 rounded-full bg-[var(--muted)]" />
      <span className="typing-dot h-2.5 w-2.5 rounded-full bg-[var(--muted)]" />
      <span className="typing-dot h-2.5 w-2.5 rounded-full bg-[var(--muted)]" />
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
    <div className={`${styles.row} ${isUser ? styles.rowUser : ""}`}>
      <div
        className={`${styles.avatar} ${
          isUser ? styles.avatarUser : styles.avatarAssistant
        }`}
        aria-hidden
      >
        {isUser ? "Y" : "⚖"}
      </div>

      <div className={styles.column}>
        <p className={styles.role}>{isUser ? "You" : "HandyLaw"}</p>
        <div
          className={`${styles.bubble} ${
            isUser
              ? styles.bubbleUser
              : isError
                ? styles.bubbleError
                : styles.bubbleAssistant
          }`}
        >
          {isUser ? (
            <div>
              <p className={styles.queryText}>{displayText}</p>
              {showRewritten && (
                <p className={styles.typedNote}>
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
            className={styles.retryBtn}
            title="Fetch other relevant दफा, excluding provisions already shown"
          >
            Try other दफा
          </button>
        )}
      </div>
    </div>
  );
}
