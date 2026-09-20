"use client";

import type { ReactNode } from "react";
import {
  speechRecognitionLang,
  useSpeechToText,
} from "@/hooks/useSpeechToText";
import styles from "./VoiceFillButton.module.css";

function MicIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="23" />
      <line x1="8" x2="16" y1="23" y2="23" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <rect x="1" y="1" width="10" height="10" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function voiceLabels(locale?: "en" | "ne") {
  if (locale === "en") {
    return {
      record: "Record",
      stop: "Stop",
      denied: "Microphone permission denied",
    };
  }
  return {
    record: "रेकर्ड",
    stop: "रोक्नुहोस्",
    denied: "माइक्रोफोन अनुमति दिइएन",
  };
}

/** Standalone mic/stop control (format bars, toolbars). */
export function VoiceFillButton({
  disabled,
  locale,
  lang,
  listenMs,
  interimResults = true,
  className,
  listeningClassName,
  onTranscript,
  onSessionStart,
}: {
  disabled?: boolean;
  locale?: "en" | "ne";
  lang?: string;
  /** Pass `null` to disable the auto-stop timer (chat dictation). */
  listenMs?: number | null;
  interimResults?: boolean;
  className?: string;
  listeningClassName?: string;
  onTranscript: (text: string) => void;
  /** Called right before a new listen session starts (reset caret-insert state). */
  onSessionStart?: () => void;
}) {
  const labels = voiceLabels(locale);
  const { supported, listening, error, start, stop } = useSpeechToText({
    lang: lang ?? speechRecognitionLang(locale),
    listenMs,
    interimResults,
    onTranscript,
  });

  if (!supported) return null;

  const label = listening
    ? labels.stop
    : error === "not-allowed" || error === "service-not-allowed"
      ? labels.denied
      : labels.record;

  return (
    <button
      type="button"
      className={`${styles.btn} ${listening ? styles.btnListening : ""} ${className ?? ""} ${
        listening && listeningClassName ? listeningClassName : ""
      }`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (listening) {
          stop();
          return;
        }
        onSessionStart?.();
        start();
      }}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={label}
      title={label}
    >
      {listening ? <StopIcon /> : <MicIcon />}
    </button>
  );
}

export function VoiceFillRow({
  children,
  disabled,
  locale,
  lang,
  listenMs,
  onTranscript,
  onSessionStart,
}: {
  children: ReactNode;
  disabled?: boolean;
  locale?: "en" | "ne";
  lang?: string;
  listenMs?: number | null;
  onTranscript: (text: string) => void;
  onSessionStart?: () => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.control}>{children}</div>
      <VoiceFillButton
        disabled={disabled}
        locale={locale}
        lang={lang}
        listenMs={listenMs}
        onTranscript={onTranscript}
        onSessionStart={onSessionStart}
      />
    </div>
  );
}

/** Insert plain text at the current selection inside a contentEditable root. */
export function insertTextAtContentEditableCaret(
  root: HTMLElement,
  text: string
): boolean {
  if (!text) return false;
  root.focus();
  const selection = window.getSelection();
  if (!selection) return false;

  const anchorInRoot =
    selection.anchorNode != null && root.contains(selection.anchorNode);
  if (!anchorInRoot || selection.rangeCount === 0) {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const inserted = document.execCommand("insertText", false, text);
  if (inserted) return true;

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

/**
 * Turn cumulative speech transcripts into append-only deltas for caret insert.
 * Returns the new text to insert (may be empty).
 */
export function speechTranscriptDelta(
  previousSessionText: string,
  nextSessionText: string
): { delta: string; nextBaseline: string } {
  if (!nextSessionText) {
    return { delta: "", nextBaseline: previousSessionText };
  }
  if (nextSessionText.startsWith(previousSessionText)) {
    return {
      delta: nextSessionText.slice(previousSessionText.length),
      nextBaseline: nextSessionText,
    };
  }
  // Interim rewrite / shrink — wait for a longer stable transcript.
  if (previousSessionText.startsWith(nextSessionText)) {
    return { delta: "", nextBaseline: previousSessionText };
  }
  return { delta: "", nextBaseline: nextSessionText };
}
