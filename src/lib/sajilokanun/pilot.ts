/** Pilot scope — only these PDFs are ingested and searchable. */
export const PILOT_PDFS = [
  "मुलुकी_देवानी_(संहिता) ऐन,२०७४.pdf",
] as const;

export function getPilotPdfs(): string[] {
  const fromEnv = process.env.PILOT_PDFS?.trim();
  if (!fromEnv) return [...PILOT_PDFS];
  // Pipe separates multiple PDFs; filenames may contain commas (e.g. "ऐन,२०७४.pdf")
  if (fromEnv.includes("|")) {
    return fromEnv.split("|").map((f) => f.trim()).filter(Boolean);
  }
  return [fromEnv];
}

export function isPilotMode(): boolean {
  return process.env.PILOT_MODE !== "false";
}
