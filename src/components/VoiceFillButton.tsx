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

export function VoiceFillRow({
  children,
  disabled,
  locale,
  lang,
  onTranscript,
}: {
  children: ReactNode;
  disabled?: boolean;
  locale?: "en" | "ne";
  lang?: string;
  onTranscript: (text: string) => void;
}) {
  const labels = voiceLabels(locale);
  const { supported, listening, error, start, stop } = useSpeechToText({
    lang: lang ?? speechRecognitionLang(locale),
    onTranscript,
  });

  if (!supported) {
    return <>{children}</>;
  }

  const label = listening
    ? labels.stop
    : error === "not-allowed" || error === "service-not-allowed"
      ? labels.denied
      : labels.record;

  return (
    <div className={styles.row}>
      <div className={styles.control}>{children}</div>
      <button
        type="button"
        className={`${styles.btn} ${listening ? styles.btnListening : ""}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (listening) stop();
          else start();
        }}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={label}
        title={label}
      >
        {listening ? <StopIcon /> : <MicIcon />}
      </button>
    </div>
  );
}
