export type UsageOperation =
  | "normalize"
  | "normalize_route"
  | "normalize_dafa"
  | "embedding"
  | "analysis"
  | "chat"
  | "narrative";

/** Cached prompt tokens billed at ~50% of input (OpenAI gpt-4.1/5, Gemini context cache). */
export const PROMPT_CACHE_BILLING_FACTOR = 0.5;

export function estimateBillableTokens(params: {
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
}): number {
  const cached = Math.min(Math.max(0, params.cachedTokens ?? 0), params.promptTokens);
  const uncachedPrompt = params.promptTokens - cached;
  return (
    uncachedPrompt +
    Math.round(cached * PROMPT_CACHE_BILLING_FACTOR) +
    params.completionTokens
  );
}

export type TokenUsageEntry = {
  operation: UsageOperation;
  provider: "openai" | "gemini";
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** OpenAI prompt cache hits or Gemini context-cache tokens (subset of prompt). */
  cachedTokens?: number;
};

export type UsageRequestType = "normalize" | "chat";

export type UsageRequestMeta = {
  requestId: string;
  requestType: UsageRequestType;
  label?: string;
};

export type UsageProcessLog = {
  id: string;
  operation: UsageOperation;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  billableTokens: number;
  createdAt: string;
};

export type UsageRequestLog = {
  requestId: string;
  requestType: UsageRequestType;
  label: string;
  createdAt: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  billableTokens: number;
  processCount: number;
  processes: UsageProcessLog[];
};

export type UsageLogResponse = {
  summary: UsageSummary;
  requests: UsageRequestLog[];
  hasMore: boolean;
};

export type UsageSummary = {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  billableTokens: number;
  userRequestCount: number;
  operationCount: number;
  /** @deprecated Use operationCount */
  requestCount: number;
  byOperation: Record<
    UsageOperation,
    { totalTokens: number; operationCount: number; requestCount: number }
  >;
  byMember?: Array<{
    userId: string;
    name: string;
    username: string;
    totalTokens: number;
    billableTokens: number;
    operationCount: number;
  }>;
};

export class UsageCollector {
  private entries: TokenUsageEntry[] = [];

  add(entry: TokenUsageEntry) {
    if (entry.totalTokens <= 0) return;
    this.entries.push(entry);
  }

  getEntries(): TokenUsageEntry[] {
    return [...this.entries];
  }

  getTotals(): Pick<
    UsageSummary,
    | "totalTokens"
    | "promptTokens"
    | "completionTokens"
    | "cachedTokens"
    | "billableTokens"
    | "operationCount"
    | "requestCount"
  > {
    const reduced = this.entries.reduce(
      (acc, entry) => ({
        totalTokens: acc.totalTokens + entry.totalTokens,
        promptTokens: acc.promptTokens + entry.promptTokens,
        completionTokens: acc.completionTokens + entry.completionTokens,
        cachedTokens: acc.cachedTokens + (entry.cachedTokens ?? 0),
        operationCount: acc.operationCount + 1,
      }),
      {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        operationCount: 0,
      }
    );
    return {
      ...reduced,
      billableTokens: estimateBillableTokens(reduced),
      requestCount: reduced.operationCount,
    };
  }
}

let activeCollector: UsageCollector | null = null;

export function setActiveUsageCollector(collector: UsageCollector | null) {
  activeCollector = collector;
}

export function recordTokenUsage(
  entry: Omit<TokenUsageEntry, "totalTokens"> & { totalTokens?: number }
) {
  const totalTokens =
    entry.totalTokens ?? entry.promptTokens + entry.completionTokens;
  if (totalTokens <= 0) return;

  activeCollector?.add({
    ...entry,
    totalTokens,
    cachedTokens: entry.cachedTokens ?? 0,
  });
}

export function getOpenAiCachedTokens(
  usage:
    | {
        prompt_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
      }
    | undefined
): { cachedTokens: number; cacheWriteTokens: number } {
  const details = usage?.prompt_tokens_details;
  return {
    cachedTokens: details?.cached_tokens ?? 0,
    cacheWriteTokens: details?.cache_write_tokens ?? 0,
  };
}

export function fromOpenAiUsage(
  usage:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
      }
    | undefined,
  params: Omit<TokenUsageEntry, "promptTokens" | "completionTokens" | "totalTokens">
) {
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens;
  const { cachedTokens, cacheWriteTokens } = getOpenAiCachedTokens(usage);
  if (cachedTokens > 0 || cacheWriteTokens > 0) {
    console.log(
      "[HandyLaw token usage]",
      JSON.stringify({
        provider: "openai",
        operation: params.operation,
        model: params.model,
        cachedTokens,
        cacheWriteTokens,
        promptTokens,
      })
    );
  }
  recordTokenUsage({
    ...params,
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
  });
}

export function fromGeminiUsage(
  usage:
    | {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
        cachedContentTokenCount?: number;
      }
    | undefined,
  params: Omit<TokenUsageEntry, "promptTokens" | "completionTokens" | "totalTokens">
) {
  const cachedTokens = usage?.cachedContentTokenCount ?? 0;
  /** Gemini promptTokenCount is uncached input only; add cached for full input size. */
  const uncachedPromptTokens = usage?.promptTokenCount ?? 0;
  const promptTokens = uncachedPromptTokens + cachedTokens;
  const completionTokens = usage?.candidatesTokenCount ?? 0;
  const totalTokens = promptTokens + completionTokens;
  recordTokenUsage({
    ...params,
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
  });
}

export function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 100) / 10}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

export function createUsageRequestId(): string {
  return crypto.randomUUID();
}

export function truncateUsageLabel(text: string, max = 120): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export async function persistSajiloKanunUsage(
  token: string | null,
  entries: TokenUsageEntry[],
  request?: UsageRequestMeta
): Promise<UsageSummary | null> {
  if (!token || entries.length === 0) return null;

  const apiUrl = process.env.API_URL ?? "http://127.0.0.1:4000";
  const response = await fetch(`${apiUrl}/api/sajilokanun-auth/usage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ entries, ...request }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    console.warn(
      "[HandyLaw token usage] Failed to persist:",
      data.error ?? response.statusText
    );
    return null;
  }

  const data = (await response.json()) as { usage: UsageSummary };
  return data.usage;
}

export const SAJILO_KANUN_USAGE_UPDATED_EVENT = "sajilo-kanun-usage-updated";

export function notifyUsageUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SAJILO_KANUN_USAGE_UPDATED_EVENT));
}
