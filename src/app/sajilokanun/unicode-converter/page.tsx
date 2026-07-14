"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SajiloKanunAppShell } from "@/components/sajilokanun/SajiloKanunAppShell";
import shellStyles from "@/components/sajilokanun/SajiloKanunAppShell.module.css";
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
import emiStyles from "@/components/user/emi.module.css";
import pageStyles from "@/app/user.module.css";

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
    <SajiloKanunAppShell
      title="Unicode Converter"
      subtitle="Convert Preeti, Kantipur, or PCS-encoded Nepali text to Devanagari Unicode. No AI — instant font mapping."
    >
      <div className={`${emiStyles.emiPanel} ${shellStyles.panelStack}`}>
        <div className={emiStyles.emiRow}>
          <div className={emiStyles.emiField} style={{ flex: "1 1 220px" }}>
            <label htmlFor="font-select">Font</label>
            <select
              id="font-select"
              className={emiStyles.emiNumberInput}
              value={font}
              onChange={(e) => setFont(e.target.value as LegacyFont)}
            >
              {FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div
            className={emiStyles.emiField}
            style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          >
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
              className={pageStyles.skGateDemoBtn}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload .txt / .docx
            </button>
            {fileName && (
              <p className={emiStyles.emiFieldHint} style={{ marginTop: "0.35rem" }}>
                {fileName}
              </p>
            )}
          </div>
        </div>

        {error && <p className={pageStyles.contactError}>{error}</p>}

        <div className={emiStyles.emiLayout}>
          <div className={emiStyles.emiField}>
            <label htmlFor="legacy-input">Input (legacy font)</label>
            <textarea
              id="legacy-input"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setError(null);
              }}
              placeholder="Paste Preeti/Kantipur text here…"
              className={emiStyles.emiNumberInput}
              style={{ resize: "vertical", minHeight: "240px", fontFamily: "inherit" }}
            />
          </div>
          <div className={emiStyles.emiField}>
            <label htmlFor="unicode-output">Output (Unicode)</label>
            <textarea
              id="unicode-output"
              value={output}
              readOnly
              placeholder="Converted Devanagari will appear here…"
              className={emiStyles.emiNumberInput}
              style={{
                resize: "vertical",
                minHeight: "240px",
                fontFamily: "inherit",
                background: "#f9fafb",
              }}
            />
          </div>
        </div>

        <div
          className={emiStyles.emiRow}
          style={{
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "1rem",
            marginTop: "0.25rem",
          }}
        >
          <p className={emiStyles.emiFieldHint} style={{ margin: 0 }}>
            {beforeRatio != null && afterRatio != null
              ? `Devanagari: ${beforeRatio}% → ${afterRatio}%`
              : "Paste text or upload a file to convert"}
          </p>
          <div className={emiStyles.emiRow} style={{ gap: "0.5rem", margin: 0 }}>
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!output}
              className={pageStyles.skGateDemoBtn}
              style={{ opacity: output ? 1 : 0.5 }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!output}
              className={pageStyles.contactSubmit}
              style={{ opacity: output ? 1 : 0.5 }}
            >
              Download .txt
            </button>
          </div>
        </div>
      </div>
      <p className={emiStyles.emiDisclaimer} style={{ marginTop: "1rem" }}>
        Font mapping runs fully in your browser — nothing is uploaded to a server.
      </p>
    </SajiloKanunAppShell>
  );
}
