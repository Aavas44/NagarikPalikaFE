"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { fetchSajiloKanunUsageLog } from "@/lib/sajilokanun-access";
import {
  formatTokenCount,
  SAJILO_KANUN_USAGE_UPDATED_EVENT,
  type UsageLogResponse,
  type UsageOperation,
  type UsageRequestLog,
} from "@/lib/sajilokanun/token-usage";

const OPERATION_LABELS: Record<UsageOperation, { en: string; ne: string }> = {
  normalize: { en: "Query normalize", ne: "प्रश्न रूपान्तरण" },
  normalize_route: { en: "Book routing", ne: "पुस्तक छनोट" },
  normalize_dafa: { en: "दफा matching", ne: "दफा मिलान" },
  embedding: { en: "Embeddings", ne: "एम्बेडिङ" },
  analysis: { en: "Query analysis", ne: "प्रश्न विश्लेषण" },
  chat: { en: "Chat answer", ne: "कुराकानी उत्तर" },
  narrative: { en: "Advocate narrative", ne: "वकिल सारांश" },
};

function formatWhen(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ne" ? "ne-NP" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function summaryCount(
  summary: UsageLogResponse["summary"],
  key: "operationCount" | "userRequestCount"
): number {
  if (key === "operationCount") {
    return summary.operationCount ?? summary.requestCount ?? 0;
  }
  return summary.userRequestCount ?? 0;
}

function RequestCard({
  request,
  locale,
  labels,
}: {
  request: UsageRequestLog;
  locale: "en" | "ne";
  labels: {
    processes: string;
    prompt: string;
    fresh: string;
    completion: string;
    cached: string;
    billable: string;
    total: string;
    normalizeRequest: string;
    chatRequest: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const typeLabel =
    request.requestType === "normalize" ? labels.normalizeRequest : labels.chatRequest;
  const billableTokens = request.billableTokens ?? request.totalTokens;

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-muted)]"
      >
        <span className="mt-0.5 text-[var(--muted)]" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">
              {typeLabel}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {formatWhen(request.createdAt, locale)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-[var(--foreground)]">
            {request.label}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {request.processCount} {labels.processes} · {formatTokenCount(billableTokens)}{" "}
            {labels.billable.toLowerCase()}
            {request.cachedTokens > 0 && (
              <>
                {" "}
                · {formatTokenCount(request.cachedTokens)} {labels.cached.toLowerCase()}
              </>
            )}
            {billableTokens !== request.totalTokens && (
              <>
                {" "}
                · {formatTokenCount(request.totalTokens)} {labels.total.toLowerCase()}
              </>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-[var(--primary)]">
            {formatTokenCount(billableTokens)}
          </div>
          {billableTokens !== request.totalTokens && (
            <div className="text-[10px] text-[var(--muted)] line-through">
              {formatTokenCount(request.totalTokens)}
            </div>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="text-[var(--muted)]">
                  <th className="pb-2 pr-3 font-medium">{labels.processes}</th>
                  <th className="pb-2 pr-3 font-medium">Model</th>
                  <th className="pb-2 pr-3 font-medium">{labels.prompt}</th>
                  <th className="pb-2 pr-3 font-medium">{labels.fresh}</th>
                  <th className="pb-2 pr-3 font-medium">{labels.cached}</th>
                  <th className="pb-2 pr-3 font-medium">{labels.completion}</th>
                  <th className="pb-2 pr-3 font-medium">{labels.billable}</th>
                  <th className="pb-2 font-medium">{labels.total}</th>
                </tr>
              </thead>
              <tbody>
                {request.processes.map((process) => {
                  const operationLabel = OPERATION_LABELS[process.operation];
                  const processBillable = process.billableTokens ?? process.totalTokens;
                  const freshPromptTokens = Math.max(
                    0,
                    process.promptTokens - process.cachedTokens
                  );
                  return (
                    <tr key={process.id} className="border-t border-[var(--border)]">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-[var(--foreground)]">
                          {locale === "ne" ? operationLabel.ne : operationLabel.en}
                        </div>
                        <div className="text-[var(--muted)]">{process.provider}</div>
                      </td>
                      <td className="py-2 pr-3 text-[var(--muted)]">{process.model}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {process.promptTokens.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {freshPromptTokens.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-emerald-700 dark:text-emerald-400">
                        {process.cachedTokens > 0
                          ? process.cachedTokens.toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {process.completionTokens.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 tabular-nums font-medium text-[var(--primary)]">
                        {processBillable.toLocaleString()}
                      </td>
                      <td className="py-2 tabular-nums text-[var(--muted)]">
                        {process.totalTokens.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  );
}

export function TokenUsageLogPanel() {
  const { locale, msg } = useLanguage();
  const labels = msg.sajilokanun.usageLog;
  const [log, setLog] = useState<UsageLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (offset = 0, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const next = await fetchSajiloKanunUsageLog({ limit: 30, offset });
      setLog((current) =>
        append && current
          ? {
              ...next,
              requests: [...current.requests, ...next.requests],
            }
          : next
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.loadError);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [labels.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => {
      void load(0, false);
    };
    window.addEventListener(SAJILO_KANUN_USAGE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(SAJILO_KANUN_USAGE_UPDATED_EVENT, handler);
  }, [load]);

  if (loading && !log) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
        {labels.loading}
      </div>
    );
  }

  if (error && !log) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  const summary = log?.summary;
  const requests = log?.requests ?? [];

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              label: labels.billableTokens,
              value: summary.billableTokens ?? summary.totalTokens,
              emphasize: true,
            },
            { label: labels.totalTokens, value: summary.totalTokens },
            { label: labels.cachedTokens, value: summary.cachedTokens },
            { label: labels.userRequests, value: summaryCount(summary, "userRequestCount"), count: true },
            {
              label: labels.llmOperations,
              value: summaryCount(summary, "operationCount"),
              count: true,
            },
            { label: labels.completionTokens, value: summary.completionTokens },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {item.label}
              </p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  item.emphasize ? "text-[var(--primary)]" : "text-[var(--foreground)]"
                }`}
              >
                {item.count
                  ? (item.value as number).toLocaleString()
                  : formatTokenCount(item.value as number)}
              </p>
            </div>
          ))}
        </div>
      )}

      {summary?.byMember && summary.byMember.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              {locale === "ne" ? "सदस्य अनुसार प्रयोग" : "Usage by member"}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="px-4 py-2 font-medium">{locale === "ne" ? "नाम" : "Name"}</th>
                  <th className="px-4 py-2 font-medium">{locale === "ne" ? "बिल योग्य" : "Billable"}</th>
                  <th className="px-4 py-2 font-medium">{locale === "ne" ? "कुल" : "Total"}</th>
                  <th className="px-4 py-2 font-medium">{locale === "ne" ? "सञ्चालन" : "Ops"}</th>
                </tr>
              </thead>
              <tbody>
                {summary.byMember.map((member) => (
                  <tr key={member.userId} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2">
                      <div className="font-medium text-[var(--foreground)]">{member.name}</div>
                      <div className="text-xs text-[var(--muted)]">@{member.username}</div>
                    </td>
                    <td className="px-4 py-2 text-[var(--primary)]">
                      {formatTokenCount(member.billableTokens)}
                    </td>
                    <td className="px-4 py-2">{formatTokenCount(member.totalTokens)}</td>
                    <td className="px-4 py-2">{member.operationCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{labels.recentRequests}</h2>
        <Link
          href="/sajilokanun/chat"
          className="text-xs font-medium text-[var(--primary)] hover:underline"
        >
          {labels.backToChat}
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          {labels.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <RequestCard
              key={request.requestId}
              request={request}
              locale={locale}
              labels={labels}
            />
          ))}
        </div>
      )}

      {log?.hasMore && (
        <button
          type="button"
          onClick={() => void load(requests.length, true)}
          disabled={loadingMore}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-60"
        >
          {loadingMore ? labels.loadingMore : labels.loadMore}
        </button>
      )}
    </div>
  );
}
