"use client";

import { FormEvent, KeyboardEvent, useMemo } from "react";
import { SelectField } from "@/components/sajilokanun/SelectField";
import { LAW_BOOKS, type BookScope } from "@/lib/sajilokanun/lawbooks";
import type { AnswerMode } from "@/lib/sajilokanun/answer-mode";
import emiStyles from "@/components/user/emi.module.css";
import pageStyles from "@/app/user.module.css";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className={emiStyles.emiRow}>
        <div className={emiStyles.emiField} style={{ marginBottom: 0 }}>
          <SelectField
            id="book-scope"
            label="Search in"
            value={bookScope}
            options={bookOptions}
            disabled={loading}
            onChange={onBookChange}
            menuMinWidth={280}
          />
        </div>
        <div className={emiStyles.emiField} style={{ marginBottom: 0 }}>
          <SelectField
            id="answer-mode"
            label="Answer as"
            value={answerMode}
            options={answerOptions}
            disabled={loading}
            onChange={onAnswerModeChange}
          />
        </div>
      </div>

      <div className="flex gap-2.5 sm:gap-2">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about a दफा or topic…"
          disabled={loading}
          rows={2}
          className={emiStyles.emiNumberInput}
          style={{ resize: "vertical", minHeight: 56, maxHeight: 140, fontSize: 16 }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className={pageStyles.contactSubmit}
          style={{ alignSelf: "flex-end", minWidth: 88, minHeight: 48 }}
          aria-label="Send message"
        >
          {loading ? "…" : "Send"}
        </button>
      </div>
      <p className={emiStyles.emiFieldHint} style={{ margin: 0, textAlign: "center" }}>
        {answerMode === "advocate"
          ? "AI Lawyer — analysis from retrieved provisions only"
          : "Answers cite indexed Muluki Ain texts only"}
      </p>
    </form>
  );
}
