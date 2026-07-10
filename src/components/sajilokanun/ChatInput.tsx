"use client";

import { FormEvent, KeyboardEvent, useMemo } from "react";
import { SelectField } from "@/components/sajilokanun/SelectField";
import { LAW_BOOKS, type BookScope } from "@/lib/sajilokanun/lawbooks";
import type { AnswerMode } from "@/lib/sajilokanun/answer-mode";

type ChatInputProps = {
  input: string;
  bookScope: BookScope;
  answerMode: AnswerMode;
  loading: boolean;
  onInputChange: (value: string) => void;
  onBookChange: (book: BookScope) => void;
  onAnswerModeChange: (mode: AnswerMode) => void;
  onSubmit: () => void;
};

export function ChatInput({
  input,
  bookScope,
  answerMode,
  loading,
  onInputChange,
  onBookChange,
  onAnswerModeChange,
  onSubmit,
}: ChatInputProps) {
  const bookOptions = useMemo(
    () => [
      { value: "auto" as BookScope, label: "Auto — all indexed books" },
      ...LAW_BOOKS.map((book) => ({
        value: book.id as BookScope,
        label: book.title,
      })),
    ],
    []
  );

  const answerOptions = useMemo(
    () => [
      { value: "quote" as AnswerMode, label: "Quote provision" },
      { value: "advocate" as AnswerMode, label: "AI Lawyer" },
    ],
    []
  );

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <footer className="sticky bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:px-4 sm:py-4">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-3xl flex-col gap-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <SelectField
            id="book-scope"
            label="Search in"
            value={bookScope}
            options={bookOptions}
            disabled={loading}
            onChange={onBookChange}
            menuMinWidth={320}
          />
          <SelectField
            id="answer-mode"
            label="Answer as"
            value={answerMode}
            options={answerOptions}
            disabled={loading}
            onChange={onAnswerModeChange}
          />
        </div>

        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a दफा, topic, or legal term… (Enter to send)"
            disabled={loading}
            rows={1}
            className="input-field min-h-[48px] max-h-32 resize-none py-3 text-base disabled:opacity-50 sm:text-sm"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-primary min-h-[48px] min-w-[48px] shrink-0 self-end px-4"
            aria-label="Send message"
          >
            {loading ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.4 20.4 21 12 3.4 3.6 3 10.8 15.6 12 3 13.2 3.4 20.4z" />
              </svg>
            )}
          </button>
        </div>
        <p className="hidden text-center text-xs leading-relaxed text-[var(--muted)] sm:block">
          Shift+Enter for new line ·{" "}
          {answerMode === "advocate"
            ? "AI Lawyer mode — reasoned analysis from retrieved provisions only"
            : "Answers cite indexed Muluki Ain texts only"}
        </p>
      </form>
    </footer>
  );
}
