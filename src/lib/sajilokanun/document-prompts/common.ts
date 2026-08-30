export function fieldStr(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === "string" ? (body[key] as string).trim() : "";
}

export function nonEmpty(value: string | undefined, fallback = "—"): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function formatDocumentDate(date?: string): string {
  const trimmed = date?.trim();
  if (trimmed) return trimmed;
  return new Intl.DateTimeFormat("ne-NP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

export function evidenceBlock(attachedEvidence: string): string {
  const lines = attachedEvidence
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "   (none listed)";
  return lines.map((line, i) => `   ${i + 1}. ${line}`).join("\n");
}

export type WitnessInputs = {
  name: string;
  address: string;
  citizenship: string;
};

export function parseWitness(
  body: Record<string, unknown>,
  prefix: "witness1" | "witness2"
): WitnessInputs {
  const nested = body[prefix];
  if (nested && typeof nested === "object") {
    const row = nested as Record<string, unknown>;
    return {
      name: typeof row.name === "string" ? row.name.trim() : "",
      address: typeof row.address === "string" ? row.address.trim() : "",
      citizenship:
        typeof row.citizenship === "string" ? row.citizenship.trim() : "",
    };
  }
  return {
    name: fieldStr(body, `${prefix}Name`),
    address: fieldStr(body, `${prefix}Address`),
    citizenship: fieldStr(body, `${prefix}Citizenship`),
  };
}

export function emptyWitness(): WitnessInputs {
  return { name: "", address: "", citizenship: "" };
}

export function witnessLines(label: string, witness: WitnessInputs): string {
  return `${label}: ${nonEmpty(witness.name)} | ठेगाना: ${nonEmpty(witness.address)} | नागरिकता: ${nonEmpty(witness.citizenship)}`;
}
