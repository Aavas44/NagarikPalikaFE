"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/sajilokanun/AppHeader";
import { SelectField } from "@/components/sajilokanun/SelectField";
import {
  extractTextFromDocx,
  isLegacyDocFile,
  isSupportedConverterFile,
} from "@/lib/sajilokanun/docx-text";
import {
  convertNepaliLegacyToUnicode,
  devanagariRatio,
  type LegacyFont,
} from "@/lib/sajilokanun/legacy-font-convert";

const FONT_OPTIONS: { value: LegacyFont; label: string }[] = [
  { value: "auto", label: "Auto (Preeti / Kantipur)" },
  { value: "preeti", label: "Preeti" },
  { value: "kantipur", label: "Kantipur" },
  { value: "pcs", label: "PCS Nepali" },
];

export default function UnicodeConverterPage() {
  const [input, setInput] = useState("");
  const [font, setFont] = useState<LegacyFont>("auto");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const output = useMemo(() => {
    if (!input.trim()) return "";
    return convertNepaliLegacyToUnicode(input, font);
  }, [input, font]);

  const beforeRatio = useMemo(
    () => (input.trim() ? (devanagariRatio(input) * 100).toFixed(1) : null),
    [input]
  );
  const afterRatio = useMemo(
    () => (output.trim() ? (devanagariRatio(output) * 100).toFixed(1) : null),
    [output]
  );

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);

    if (isLegacyDocFile(file.name)) {
      setError(
        "Legacy .doc files are not supported. Please save as .docx or paste the text."
      );
      return;
    }

    if (!isSupportedConverterFile(file.name)) {
      setError("Supported formats: .txt and .docx");
      return;
    }

    try {
      const text = file.name.toLowerCase().endsWith(".docx")
        ? await extractTextFromDocx(file)
        : await file.text();
      setInput(text);
    } catch {
      setError("Could not read the file. Try a different file or paste the text.");
    }
  }, []);

  async function handleCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
  }

  function handleDownload() {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName
      ? fileName.replace(/\.(docx|txt)$/i, ".unicode.txt")
      : "converted.unicode.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            Unicode Converter
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            Convert Preeti, Kantipur, or PCS-encoded Nepali text to Devanagari
            Unicode. No AI — instant font mapping.
          </p>
        </div>

        <div className="card space-y-4 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:max-w-xs">
              <SelectField
                id="font-select"
                label="Font"
                value={font}
                options={FONT_OPTIONS}
                onChange={setFont}
              />
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] sm:w-auto sm:px-3 sm:py-2 sm:text-xs"
              >
                Upload .txt / .docx
              </button>
              {fileName && (
                <span className="truncate text-center text-xs text-[var(--muted)] sm:text-left">
                  {fileName}
                </span>
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-relaxed text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="legacy-input">
                Input (legacy font)
              </label>
              <textarea
                id="legacy-input"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setError(null);
                }}
                placeholder="Paste Preeti/Kantipur text here…"
                className="input-field min-h-[200px] resize-y text-base leading-relaxed sm:min-h-[240px] sm:text-sm md:min-h-[280px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="unicode-output">
                Output (Unicode)
              </label>
              <textarea
                id="unicode-output"
                value={output}
                readOnly
                placeholder="Converted Devanagari will appear here…"
                className="input-field min-h-[200px] resize-y bg-[var(--surface-muted)] text-base leading-relaxed sm:min-h-[240px] sm:text-sm md:min-h-[280px]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-xs text-[var(--muted)] sm:text-left">
              {beforeRatio != null && afterRatio != null
                ? `Devanagari: ${beforeRatio}% → ${afterRatio}%`
                : "Paste text or upload a file to convert"}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={!output}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-xs"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!output}
                className="btn-primary px-4 py-2.5 text-sm sm:px-3 sm:py-1.5 sm:text-xs disabled:opacity-50"
              >
                Download .txt
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
