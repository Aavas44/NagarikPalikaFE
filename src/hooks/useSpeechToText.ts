"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const SPEECH_LISTEN_MS = 5000;

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0?: SpeechRecognitionAlternativeLike;
  length: number;
};

type SpeechRecognitionEventLike = {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return (
    browserWindow.SpeechRecognition ??
    browserWindow.webkitSpeechRecognition ??
    null
  );
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function speechRecognitionLang(locale?: "en" | "ne"): string {
  return locale === "en" ? "en-US" : "ne-NP";
}

let abortActiveSession: (() => void) | null = null;

function transcriptFromEvent(event: SpeechRecognitionEventLike): string {
  let text = "";
  for (let i = 0; i < event.results.length; i++) {
    text += event.results[i]?.[0]?.transcript ?? "";
  }
  return text.replace(/\s+/g, " ").trim();
}

export function useSpeechToText(options: {
  lang?: string;
  listenMs?: number;
  onTranscript: (text: string) => void;
}) {
  const { lang = "ne-NP", listenMs = SPEECH_LISTEN_MS, onTranscript } = options;
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const langRef = useRef(lang);
  langRef.current = lang;
  const listenMsRef = useRef(listenMs);
  listenMsRef.current = listenMs;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const abortRef = useRef<() => void>(() => {});
  const aliveRef = useRef(true);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current == null) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const finish = useCallback(() => {
    clearTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    }
    if (abortActiveSession === abortRef.current) {
      abortActiveSession = null;
    }
    setListening(false);
  }, [clearTimer]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      finish();
      return;
    }
    try {
      recognition.stop();
    } catch {
      finish();
    }
  }, [finish]);

  stopRef.current = stop;

  const abort = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      finish();
      return;
    }
    try {
      recognition.abort();
    } catch {
      finish();
    }
  }, [finish]);

  abortRef.current = abort;

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    abortActiveSession?.();

    const recognition = new Ctor();
    recognition.lang = langRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = transcriptFromEvent(event);
      if (text) onTranscriptRef.current(text);
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(event.error);
      }
    };

    recognition.onend = () => {
      finish();
    };

    recognitionRef.current = recognition;
    abortActiveSession = abortRef.current;
    setError(null);
    setListening(true);

    const armTimeout = () => {
      timeoutRef.current = window.setTimeout(() => {
        stopRef.current();
      }, listenMsRef.current);
    };

    try {
      recognition.start();
      armTimeout();
    } catch {
      window.setTimeout(() => {
        if (!aliveRef.current || recognitionRef.current !== recognition) return;
        try {
          recognition.start();
          armTimeout();
        } catch {
          finish();
        }
      }, 80);
    }
  }, [finish]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stop();
    };
  }, [stop]);

  return { supported, listening, error, start, stop };
}
