"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminFetchTeamAccounts,
  adminFetchTeams,
  adminFetchTeamUsage,
  type AdminTeam,
  type TeamMember,
} from "@/lib/sajilokanun-access";
import {
  formatTokenCount,
  type UsageOperation,
  type UsageRequestLog,
  type UsageSummary,
} from "@/lib/sajilokanun/token-usage";
import styles from "@/app/admin.module.css";

const OPERATION_LABELS: Record<UsageOperation, string> = {
  normalize: "Query normalize",
  normalize_route: "Book routing",
  normalize_dafa: "Dafa matching",
  embedding: "Embeddings",
  analysis: "Query analysis",
  chat: "Chat answer",
  narrative: "Advocate narrative",
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function RequestRow({ request }: { request: UsageRequestLog }) {
  const [open, setOpen] = useState(false);
  const billableTokens = request.billableTokens ?? request.totalTokens;
  const memberLabel =
    request.userName || request.username
      ? `${request.userName || "Unknown"}${
          request.username ? ` (@${request.username})` : ""
        }`
      : null;

  return (
    <article
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#fff",
        marginBottom: 10,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          textAlign: "left",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ color: "#6b7280", marginTop: 2 }} aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span
              style={{
                borderRadius: 999,
                background: "#e8f1fb",
                color: "#185fa5",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                padding: "2px 8px",
              }}
            >
              {request.requestType === "normalize" ? "Normalize" : "Chat"}
            </span>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {formatWhen(request.createdAt)}
            </span>
            {memberLabel ? (
              <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
                {memberLabel}
              </span>
            ) : null}
          </div>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 14,
              fontWeight: 600,
              color: "#111827",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {request.label}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
            {request.processCount} processes · {formatTokenCount(billableTokens)}{" "}
            billable
            {request.cachedTokens > 0
              ? ` · ${formatTokenCount(request.cachedTokens)} cached`
              : ""}
          </p>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#185fa5" }}>
            {formatTokenCount(billableTokens)}
          </div>
          {billableTokens !== request.totalTokens ? (
            <div
              style={{
                fontSize: 10,
                color: "#9ca3af",
                textDecoration: "line-through",
              }}
            >
              {formatTokenCount(request.totalTokens)}
            </div>
          ) : null}
        </div>
      </button>

      {open ? (
        <div className={styles.tblWrap} style={{ borderTop: "1px solid #e5e7eb" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Operation</th>
                <th>Model</th>
                <th>Prompt</th>
                <th>Cached</th>
                <th>Completion</th>
                <th>Billable</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {request.processes.map((process) => {
                const processBillable =
                  process.billableTokens ??
                  process.promptTokens + process.completionTokens;
                return (
                  <tr key={process.id}>
                    <td>
                      {OPERATION_LABELS[process.operation] ?? process.operation}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        {process.provider}/
                      </span>
                      {process.model}
                    </td>
                    <td>{process.promptTokens.toLocaleString()}</td>
                    <td>
                      {process.cachedTokens > 0
                        ? process.cachedTokens.toLocaleString()
                        : "—"}
                    </td>
                    <td>{process.completionTokens.toLocaleString()}</td>
                    <td style={{ color: "#185fa5", fontWeight: 600 }}>
                      {processBillable.toLocaleString()}
                    </td>
                    <td style={{ color: "#6b7280" }}>
                      {process.totalTokens.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}

function SummaryCards({ summary }: { summary: UsageSummary }) {
  const items = [
    {
      label: "Billable tokens",
      value: formatTokenCount(summary.billableTokens ?? summary.totalTokens),
      color: "#185fa5",
    },
    {
      label: "Total tokens",
      value: formatTokenCount(summary.totalTokens),
    },
    {
      label: "Cached tokens",
      value: formatTokenCount(summary.cachedTokens),
    },
    {
      label: "User requests",
      value: (
        summary.userRequestCount ?? 0
      ).toLocaleString(),
    },
    {
      label: "LLM operations",
      value: (
        summary.operationCount ?? summary.requestCount ?? 0
      ).toLocaleString(),
    },
    {
      label: "Completion tokens",
      value: formatTokenCount(summary.completionTokens),
    },
  ];

  return (
    <div className={styles.metrics} style={{ marginTop: "1rem", marginBottom: "1rem" }}>
      {items.map((item) => (
        <div key={item.label} className={styles.metric}>
          <div
            className={styles.metricVal}
            style={item.color ? { color: item.color } : undefined}
          >
            {item.value}
          </div>
          <div className={styles.metricLabel}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export function AdminSajiloKanunRequestsPanel() {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [teamId, setTeamId] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberId, setMemberId] = useState("");
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [requests, setRequests] = useState<UsageRequestLog[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await adminFetchTeams();
        if (cancelled) return;
        setTeams(data);
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load firms");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!teamId) {
      setMembers([]);
      setMemberId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const accounts = await adminFetchTeamAccounts(teamId);
        if (cancelled) return;
        setMembers(accounts);
        setMemberId("");
        setError("");
      } catch (err) {
        if (!cancelled) {
          setMembers([]);
          setError(err instanceof Error ? err.message : "Failed to load members");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const loadRequests = useCallback(
    async (offset = 0, append = false) => {
      if (!teamId) {
        setSummary(null);
        setRequests([]);
        setHasMore(false);
        return;
      }
      try {
        if (append) setLoadingMore(true);
        else setLoadingRequests(true);
        const log = await adminFetchTeamUsage(teamId, {
          limit: 30,
          offset,
          ...(memberId ? { userId: memberId } : {}),
        });
        if (!append) setSummary(log.summary);
        setRequests((current) =>
          append ? [...current, ...log.requests] : log.requests
        );
        setHasMore(log.hasMore);
        setError("");
      } catch (err) {
        if (!append) {
          setSummary(null);
          setRequests([]);
        }
        setError(err instanceof Error ? err.message : "Failed to load usage");
      } finally {
        setLoadingRequests(false);
        setLoadingMore(false);
      }
    },
    [teamId, memberId]
  );

  useEffect(() => {
    void loadRequests(0, false);
  }, [loadRequests]);

  if (loading) {
    return (
      <section id="sajilo-kanun-usage" className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Sajilo Kanun — Token usage</h2>
        </div>
        <p className={styles.panelDesc}>Loading…</p>
      </section>
    );
  }

  return (
    <section id="sajilo-kanun-usage" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Sajilo Kanun — Token usage</h2>
      </div>
      <p className={styles.panelDesc}>
        Firm-wide AI token usage and request log. Filter by firm and member.
      </p>

      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          aria-label="Filter by firm"
        >
          <option value="">Select a firm</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          aria-label="Filter by member"
          disabled={!teamId}
        >
          <option value="">All members</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} (@{member.username})
              {member.role === "admin" ? " — admin" : ""}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className={styles.formError}>{error}</p> : null}

      {!teamId ? (
        <p className={styles.panelDesc} style={{ marginTop: "1rem" }}>
          Select a firm to view token usage.
        </p>
      ) : loadingRequests ? (
        <p className={styles.panelDesc} style={{ marginTop: "1rem" }}>
          Loading usage…
        </p>
      ) : (
        <>
          {summary ? <SummaryCards summary={summary} /> : null}

          {summary?.byMember && summary.byMember.length > 0 && !memberId ? (
            <div className={styles.tblWrap} style={{ marginBottom: "1.25rem" }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Billable</th>
                    <th>Total</th>
                    <th>Ops</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byMember.map((member) => (
                    <tr key={member.userId}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{member.name}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          @{member.username}
                        </div>
                      </td>
                      <td style={{ color: "#185fa5", fontWeight: 600 }}>
                        {formatTokenCount(member.billableTokens)}
                      </td>
                      <td>{formatTokenCount(member.totalTokens)}</td>
                      <td>{member.operationCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <h3
            style={{
              margin: "0 0 0.75rem",
              fontSize: 14,
              fontWeight: 600,
              color: "#111827",
            }}
          >
            Recent requests
          </h3>

          {requests.length === 0 ? (
            <p className={styles.panelDesc}>No requests found for this filter.</p>
          ) : (
            <div>
              {requests.map((request) => (
                <RequestRow key={request.requestId} request={request} />
              ))}
              {hasMore ? (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={loadingMore}
                  onClick={() => void loadRequests(requests.length, true)}
                  style={{ width: "100%", marginTop: 4 }}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              ) : null}
            </div>
          )}

          <p className={styles.panelDesc} style={{ marginTop: "1rem" }}>
            Estimates only — billing depends on provider pricing and cache rates.
          </p>
        </>
      )}
    </section>
  );
}
