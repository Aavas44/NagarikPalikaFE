"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SajiloKanunAppShell } from "@/components/sajilokanun/SajiloKanunAppShell";
import { StatusToast } from "@/components/sajilokanun/StatusToast";
import shellStyles from "@/components/sajilokanun/SajiloKanunAppShell.module.css";
import caseChatStyles from "@/components/sajilokanun/CaseChat.module.css";
import { useLanguage } from "@/context/LanguageContext";
import {
  fetchFirmActivityDashboard,
  fetchFirmUnreadMessages,
  fetchSajiloKanunMe,
  fetchSupremeCourtPesiForCase,
  getSkRoleFromToken,
  type DashboardActivityRecord,
  type DashboardActivityUrgency,
  type DashboardPesiRecord,
  type FirmActivityDashboard,
  type FirmUnreadMessages,
} from "@/lib/sajilokanun-access";
import {
  formatBsDate,
  getTodayBs,
  bsToAd,
  daysBetweenAd,
  type BsDate,
} from "@/lib/nepaliCalendar";
import { toDevanagariDigits } from "@/lib/sajilokanun/nepali-digits";
import emiStyles from "@/components/user/emi.module.css";
import pageStyles from "@/app/user.module.css";

type FilterKey = "actionable" | "overdue" | "today" | "week" | "all";

function remainingDaysFromBs(bs: BsDate) {
  return daysBetweenAd(bsToAd(getTodayBs()), bsToAd(bs));
}

function formatRemaining(
  days: number,
  locale: "en" | "ne",
  labels: { today: string; left: string; overdue: string }
) {
  const n =
    locale === "ne"
      ? toDevanagariDigits(String(Math.abs(days)))
      : String(Math.abs(days));
  if (days === 0) return labels.today;
  if (days > 0) return labels.left.replace("{n}", n);
  return labels.overdue.replace("{n}", n);
}

function urgencyColor(urgency: DashboardActivityUrgency) {
  if (urgency === "overdue") return "#b42318";
  if (urgency === "today") return "#b54708";
  if (urgency === "week") return "#175cd3";
  return "#027a48";
}

function urgencyFromRemaining(days: number): DashboardActivityUrgency {
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "upcoming";
}

function matchesUrgencyFilter(
  urgency: DashboardActivityUrgency,
  filter: FilterKey
) {
  if (filter === "all") return true;
  if (filter === "overdue") return urgency === "overdue";
  if (filter === "today") return urgency === "today";
  if (filter === "week") return urgency === "today" || urgency === "week";
  if (filter === "actionable") {
    return (
      urgency === "today" || urgency === "week" || urgency === "upcoming"
    );
  }
  return true;
}

function sortByRemainingDays<T extends { bsYear: number; bsMonth: number; bsDay: number; caseNo: string }>(
  rows: T[]
): T[] {
  return [...rows]
    .map((row) => ({
      row,
      remaining: remainingDaysFromBs({
        year: row.bsYear,
        month: row.bsMonth,
        day: row.bsDay,
      }),
    }))
    .sort((a, b) => {
      if (a.remaining !== b.remaining) return a.remaining - b.remaining;
      return a.row.caseNo.localeCompare(b.row.caseNo);
    })
    .map(({ row }) => row);
}

const PARTIES_MAX_CHARS = 42;

function truncateParties(value: string, maxChars = PARTIES_MAX_CHARS): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "—";
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars).trimEnd()}…`;
}

function courtLabel(
  row: { courtName?: string; courtNameEn?: string },
  locale: "en" | "ne"
): string {
  if (locale === "en") {
    return (row.courtNameEn || row.courtName || "").trim();
  }
  return (row.courtName || row.courtNameEn || "").trim();
}

export default function SajiloKanunDashboardPage() {
  const { locale, msg } = useLanguage();
  const t = msg.sajilokanun.dashboard;
  const [data, setData] = useState<FirmActivityDashboard | null>(null);
  const [unread, setUnread] = useState<FirmUnreadMessages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("actionable");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isAdmin, setIsAdmin] = useState(() => getSkRoleFromToken() === "admin");
  const [refreshingCaseId, setRefreshingCaseId] = useState<string | null>(null);
  const [pesiToast, setPesiToast] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchSajiloKanunMe()
      .then((me) => setIsAdmin(me.role === "admin"))
      .catch(() => setIsAdmin(getSkRoleFromToken() === "admin"));
  }, []);

  async function loadDashboard() {
    const activities = await fetchFirmActivityDashboard();
    setData(activities);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loadDashboard()
      .then(() => {
        if (!cancelled) setError("");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t.loadError);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    fetchFirmUnreadMessages()
      .then((unreadMessages) => {
        if (!cancelled) setUnread(unreadMessages);
      })
      .catch(() => {
        if (!cancelled) setUnread(null);
      });

    return () => {
      cancelled = true;
    };
  }, [t.loadError]);

  async function handleRefreshCasePesi(caseId: string) {
    if (!isAdmin || refreshingCaseId) return;
    setRefreshingCaseId(caseId);
    setError("");
    setPesiToast(null);
    try {
      const result = await fetchSupremeCourtPesiForCase(caseId);
      await loadDashboard();
      if ((result.matchedCount ?? 0) > 0) {
        setPesiToast({
          tone: "success",
          message: t.refreshPesiDone.replace(
            "{matched}",
            String(result.matchedCount)
          ),
        });
      } else {
        setPesiToast({
          tone: "error",
          message: t.refreshPesiNone,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t.refreshPesiError;
      setError(message);
      setPesiToast({ tone: "error", message });
    } finally {
      setRefreshingCaseId(null);
    }
  }

  const filteredActivities = useMemo(() => {
    const rows = data?.activities ?? [];
    const matched = rows.filter((row) => {
      if (typeFilter !== "all" && row.activityType !== typeFilter) return false;
      const remaining = remainingDaysFromBs({
        year: row.bsYear,
        month: row.bsMonth,
        day: row.bsDay,
      });
      return matchesUrgencyFilter(urgencyFromRemaining(remaining), filter);
    });
    return sortByRemainingDays(matched);
  }, [data, filter, typeFilter]);

  const filteredPesi = useMemo(() => {
    const rows = data?.pesiRows ?? [];
    const matched = rows.filter((row) => {
      // Pesi rows are court hearings — hide when filtering to unrelated activity types.
      if (
        typeFilter !== "all" &&
        typeFilter !== "hearing_date"
      ) {
        return false;
      }
      const remaining = remainingDaysFromBs({
        year: row.bsYear,
        month: row.bsMonth,
        day: row.bsDay,
      });
      return matchesUrgencyFilter(urgencyFromRemaining(remaining), filter);
    });
    return sortByRemainingDays(matched);
  }, [data, filter, typeFilter]);

  const remainingLabels = {
    today: t.remainingToday,
    left: t.remainingLeft,
    overdue: t.remainingOverdue,
  };

  return (
    <SajiloKanunAppShell title={t.title} subtitle={t.subtitle}>
      {pesiToast ? (
        <StatusToast
          message={pesiToast.message}
          tone={pesiToast.tone}
          onDismiss={() => setPesiToast(null)}
        />
      ) : null}
      {error && <p className={pageStyles.contactError}>{error}</p>}

      <div className={shellStyles.panelStack}>
        <div className={emiStyles.emiStatGrid}>
          <SummaryCard label={t.statOpenCases} value={data?.summary.openCases ?? 0} locale={locale} />
          <SummaryCard
            label={t.statOverdue}
            value={data?.summary.overdue ?? 0}
            locale={locale}
            tone="danger"
          />
          <SummaryCard
            label={t.statDueToday}
            value={data?.summary.dueToday ?? 0}
            locale={locale}
            tone="warn"
          />
          <SummaryCard
            label={t.statDueWeek}
            value={data?.summary.dueThisWeek ?? 0}
            locale={locale}
            tone="info"
          />
          <SummaryCard
            label={t.statUpcoming}
            value={data?.summary.upcoming ?? 0}
            locale={locale}
          />
          <SummaryCard label={t.statTotal} value={data?.summary.total ?? 0} locale={locale} />
        </div>

        {!loading && unread && unread.threads.length > 0 && (
          <div className={emiStyles.emiPanel}>
            <div className={caseChatStyles.sectionHeader}>
              <div>
                <h2 className={emiStyles.emiPanelTitle}>{t.unreadTitle}</h2>
                <p className={emiStyles.emiFieldHint} style={{ marginBottom: 0 }}>
                  {t.unreadHint}
                </p>
              </div>
              <span className={caseChatStyles.unreadCountPill}>
                {t.unreadCount.replace(
                  "{n}",
                  locale === "ne"
                    ? toDevanagariDigits(String(unread.totalUnread))
                    : String(unread.totalUnread)
                )}
              </span>
            </div>

            <div className={caseChatStyles.unreadThreadList}>
              {unread.threads.map((thread) => (
                <article key={thread.caseId} className={caseChatStyles.unreadThread}>
                  <div className={caseChatStyles.unreadThreadMeta}>
                    <strong style={{ color: "#042c53", display: "block" }}>
                      {thread.caseTitle || thread.caseNo}
                    </strong>
                    <p className={caseChatStyles.activityCardLabel}>
                      {thread.caseNo}
                      {thread.caseStatus ? ` · ${thread.caseStatus}` : ""}
                      {" · "}
                      {t.unreadFrom.replace("{name}", thread.latestSenderName || "—")}
                    </p>
                    <p className={caseChatStyles.unreadThreadPreview}>{thread.latestBody}</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                    <span className={caseChatStyles.unreadCountPill}>
                      {locale === "ne"
                        ? toDevanagariDigits(String(thread.unreadCount))
                        : thread.unreadCount}
                    </span>
                    <Link
                      href={`/sajilokanun/cases?case=${thread.caseId}`}
                      className={emiStyles.emiGlossaryLink}
                    >
                      {t.openMessages}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className={emiStyles.emiPanel}>
          <div className={caseChatStyles.sectionHeader}>
            <div>
              <h2 className={emiStyles.emiPanelTitle}>{t.tableTitle}</h2>
              <p className={emiStyles.emiFieldHint} style={{ marginBottom: 0 }}>
                {t.tableHint}
              </p>
            </div>
          </div>

          <div className={caseChatStyles.tabs} role="tablist" aria-label={t.filterLabel}>
            {(
              [
                ["actionable", t.filterActionable],
                ["overdue", t.filterOverdue],
                ["today", t.filterToday],
                ["week", t.filterWeek],
                ["all", t.filterAll],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={`${caseChatStyles.tab} ${
                  filter === key ? caseChatStyles.tabActive : ""
                }`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={emiStyles.emiField} style={{ marginBottom: "1rem", maxWidth: 280 }}>
            <label htmlFor="dashboard-type-filter">{t.typeFilterLabel}</label>
            <select
              id="dashboard-type-filter"
              className={emiStyles.emiNumberInput}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">{t.typeAll}</option>
              <option value="case_registration">{t.typeCaseRegistration}</option>
              <option value="notice_service">{t.typeNoticeService}</option>
              <option value="reply_filing">{t.typeReplyFiling}</option>
              <option value="hearing_date">{t.typeHearingDate}</option>
              <option value="witness_testimony">{t.typeWitnessTestimony}</option>
            </select>
          </div>

          {loading ? (
            <p className={pageStyles.calculatorSubtitle}>{t.loading}</p>
          ) : (
            <>
              <section style={{ marginBottom: "1.75rem" }}>
                <div className={caseChatStyles.sectionHeader}>
                  <div>
                    <h3 className={emiStyles.emiPanelTitle} style={{ fontSize: "1.05rem" }}>
                      {t.pesiSectionTitle}
                    </h3>
                  </div>
                </div>

                {filteredPesi.length === 0 ? (
                  <p className={pageStyles.calculatorSubtitle}>{t.pesiEmpty}</p>
                ) : (
                  <>
                    <div className={caseChatStyles.activityTableWrap}>
                      <table className={caseChatStyles.activityTable}>
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                            <th className="pb-2 pr-3 font-medium">{t.colCase}</th>
                            <th className="pb-2 pr-3 font-medium">{t.colCourt}</th>
                            <th className="pb-2 pr-3 font-medium">{t.colPesiDate}</th>
                            <th className="pb-2 pr-3 font-medium">{t.colRemaining}</th>
                            <th className="pb-2 pr-3 font-medium">{t.colMatter}</th>
                            <th className="pb-2 pr-3 font-medium">{t.colParties}</th>
                            <th className="pb-2 font-medium">{t.colActions}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPesi.map((row) => (
                            <PesiRow
                              key={row.id}
                              row={row}
                              locale={locale}
                              remainingLabels={remainingLabels}
                              openLabel={t.openCase}
                              showRefresh={isAdmin}
                              refreshing={refreshingCaseId === row.caseId}
                              refreshBusy={Boolean(refreshingCaseId)}
                              refreshLabel={t.refreshPesi}
                              refreshBusyLabel={t.refreshPesiBusy}
                              onRefresh={() => void handleRefreshCasePesi(row.caseId)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className={caseChatStyles.activityCards}>
                      {filteredPesi.map((row) => {
                        const bsDate = {
                          year: row.bsYear,
                          month: row.bsMonth,
                          day: row.bsDay,
                        };
                        const remaining = remainingDaysFromBs(bsDate);
                        const urgency = urgencyFromRemaining(remaining);
                        return (
                          <article key={row.id} className={caseChatStyles.activityCard}>
                            <strong style={{ color: "#042c53", display: "block" }}>
                              {row.caseTitle || row.caseNo}
                            </strong>
                            <p className={caseChatStyles.activityCardLabel}>
                              {row.caseNo}
                              {row.caseStatus ? ` · ${row.caseStatus}` : ""}
                            </p>
                            {courtLabel(row, locale) ? (
                              <p className={caseChatStyles.activityCardLabel}>
                                {courtLabel(row, locale)}
                              </p>
                            ) : null}
                            <div className={caseChatStyles.activityCardRow}>
                              <div>
                                <p className={caseChatStyles.activityCardLabel}>
                                  {t.colPesiDate}
                                </p>
                                <p className={caseChatStyles.activityCardValue}>
                                  {row.pesiDate}
                                </p>
                              </div>
                              <div>
                                <p className={caseChatStyles.activityCardLabel}>
                                  {t.colRemaining}
                                </p>
                                <p
                                  className={caseChatStyles.activityCardValue}
                                  style={{
                                    fontWeight: 600,
                                    color: urgencyColor(urgency),
                                  }}
                                >
                                  {formatRemaining(remaining, locale, remainingLabels)}
                                </p>
                              </div>
                            </div>
                            <p className={caseChatStyles.activityCardValue}>
                              {row.matter}
                            </p>
                            <p
                              className={pageStyles.calculatorSubtitle}
                              title={row.parties || undefined}
                            >
                              {truncateParties(row.parties || "")}
                            </p>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                                flexWrap: "wrap",
                              }}
                            >
                              <Link
                                href={`/sajilokanun/cases?case=${row.caseId}`}
                                className={emiStyles.emiGlossaryLink}
                              >
                                {t.openCase}
                              </Link>
                              {isAdmin ? (
                                <RefreshPesiIconButton
                                  label={t.refreshPesi}
                                  busyLabel={t.refreshPesiBusy}
                                  busy={refreshingCaseId === row.caseId}
                                  disabled={Boolean(refreshingCaseId)}
                                  onClick={() => void handleRefreshCasePesi(row.caseId)}
                                />
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

              <section>
                <div className={caseChatStyles.sectionHeader}>
                  <div>
                    <h3 className={emiStyles.emiPanelTitle} style={{ fontSize: "1.05rem" }}>
                      {t.activitySectionTitle}
                    </h3>
                    <p className={emiStyles.emiFieldHint} style={{ marginBottom: 0 }}>
                      {t.activitySectionHint}
                    </p>
                  </div>
                </div>

                {filteredActivities.length === 0 ? (
                  <p className={pageStyles.calculatorSubtitle}>{t.empty}</p>
                ) : (
                  <>
                    <div className={caseChatStyles.activityTableWrap}>
                      <table className={caseChatStyles.activityTable}>
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                            <th className="pb-2 pr-3 font-medium">{t.colCase}</th>
                            <th className="pb-2 pr-3 font-medium">{t.colCourt}</th>
                            <th className="pb-2 pr-3 font-medium">{t.colActivity}</th>
                            <th className="pb-2 pr-3 font-medium">{t.colDate}</th>
                            <th className="pb-2 pr-3 font-medium">{t.colRemaining}</th>
                            <th className="pb-2 pr-3 font-medium">{t.colNote}</th>
                            <th className="pb-2 font-medium">{t.colActions}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredActivities.map((row) => (
                            <ActivityRow
                              key={row.id}
                              row={row}
                              locale={locale}
                              remainingLabels={remainingLabels}
                              openLabel={t.openCase}
                              showRefresh={isAdmin}
                              refreshing={refreshingCaseId === row.caseId}
                              refreshBusy={Boolean(refreshingCaseId)}
                              refreshLabel={t.refreshPesi}
                              refreshBusyLabel={t.refreshPesiBusy}
                              onRefresh={() => void handleRefreshCasePesi(row.caseId)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className={caseChatStyles.activityCards}>
                      {filteredActivities.map((row) => {
                        const bsDate = {
                          year: row.bsYear,
                          month: row.bsMonth,
                          day: row.bsDay,
                        };
                        const remaining = remainingDaysFromBs(bsDate);
                        return (
                          <article key={row.id} className={caseChatStyles.activityCard}>
                            <strong style={{ color: "#042c53", display: "block" }}>
                              {row.caseTitle || row.caseNo}
                            </strong>
                            <p className={caseChatStyles.activityCardLabel}>
                              {row.caseNo}
                              {row.caseStatus ? ` · ${row.caseStatus}` : ""}
                            </p>
                            {courtLabel(row, locale) ? (
                              <p className={caseChatStyles.activityCardLabel}>
                                {courtLabel(row, locale)}
                              </p>
                            ) : null}
                            <div className={caseChatStyles.activityCardRow}>
                              <div>
                                <p className={caseChatStyles.activityCardLabel}>
                                  {t.colActivity}
                                </p>
                                <p className={caseChatStyles.activityCardValue}>
                                  {row.labelNe} ({row.labelEn})
                                </p>
                              </div>
                              <div>
                                <p className={caseChatStyles.activityCardLabel}>
                                  {t.colRemaining}
                                </p>
                                <p
                                  className={caseChatStyles.activityCardValue}
                                  style={{
                                    fontWeight: 600,
                                    color: urgencyColor(
                                      urgencyFromRemaining(remaining)
                                    ),
                                  }}
                                >
                                  {formatRemaining(remaining, locale, remainingLabels)}
                                </p>
                              </div>
                            </div>
                            <div className={caseChatStyles.activityCardRow}>
                              <div>
                                <p className={caseChatStyles.activityCardLabel}>
                                  {t.colDate}
                                </p>
                                <p className={caseChatStyles.activityCardValue}>
                                  {formatBsDate(bsDate, locale)}
                                </p>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.75rem",
                                  flexWrap: "wrap",
                                }}
                              >
                                <Link
                                  href={`/sajilokanun/cases?case=${row.caseId}`}
                                  className={emiStyles.emiGlossaryLink}
                                >
                                  {t.openCase}
                                </Link>
                                {isAdmin ? (
                                  <RefreshPesiIconButton
                                    label={t.refreshPesi}
                                    busyLabel={t.refreshPesiBusy}
                                    busy={refreshingCaseId === row.caseId}
                                    disabled={Boolean(refreshingCaseId)}
                                    onClick={() => void handleRefreshCasePesi(row.caseId)}
                                  />
                                ) : null}
                              </div>
                            </div>
                            {row.note ? (
                              <p
                                className={pageStyles.calculatorSubtitle}
                                style={{ marginTop: "0.5rem" }}
                              >
                                {row.note}
                              </p>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </SajiloKanunAppShell>
  );
}

function SummaryCard({
  label,
  value,
  locale,
  tone,
}: {
  label: string;
  value: number;
  locale: "en" | "ne";
  tone?: "danger" | "warn" | "info";
}) {
  const color =
    tone === "danger" ? "#b42318" : tone === "warn" ? "#b54708" : tone === "info" ? "#175cd3" : "#042c53";
  const display = locale === "ne" ? toDevanagariDigits(String(value)) : String(value);
  return (
    <div className={`${emiStyles.emiStat} ${emiStyles.emiFadeCard}`}>
      <span className={emiStyles.emiStatLabel}>{label}</span>
      <span className={emiStyles.emiStatValue} style={{ color }}>
        {display}
      </span>
    </div>
  );
}

function RefreshPesiIconButton({
  label,
  busyLabel,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={busy ? busyLabel : label}
      title={busy ? busyLabel : label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "2rem",
        height: "2rem",
        padding: 0,
        border: "1px solid #c5d4e8",
        borderRadius: "0.5rem",
        background: busy ? "#eef4fb" : "#fff",
        color: "#042c53",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled && !busy ? 0.55 : 1,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={busy ? caseChatStyles.refreshIconSpin : undefined}
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    </button>
  );
}

function PesiRow({
  row,
  locale,
  remainingLabels,
  openLabel,
  showRefresh,
  refreshing,
  refreshBusy,
  refreshLabel,
  refreshBusyLabel,
  onRefresh,
}: {
  row: DashboardPesiRecord;
  locale: "en" | "ne";
  remainingLabels: { today: string; left: string; overdue: string };
  openLabel: string;
  showRefresh: boolean;
  refreshing: boolean;
  refreshBusy: boolean;
  refreshLabel: string;
  refreshBusyLabel: string;
  onRefresh: () => void;
}) {
  const bsDate = { year: row.bsYear, month: row.bsMonth, day: row.bsDay };
  const remaining = remainingDaysFromBs(bsDate);
  const urgency = urgencyFromRemaining(remaining);
  const court = courtLabel(row, locale);
  const partiesFull = (row.parties || "").replace(/\s+/g, " ").trim();
  return (
    <tr className="border-b border-[var(--border)] align-top">
      <td className="py-2.5 pr-3">
        <div className="font-medium text-[var(--foreground)]">
          {row.caseTitle || "—"}
        </div>
        <div className="text-xs text-[var(--muted)]">
          {row.caseNo}
          {row.caseStatus ? ` · ${row.caseStatus}` : ""}
        </div>
      </td>
      <td className="py-2.5 pr-3 text-[var(--muted)]" title={court || undefined}>
        {court || "—"}
      </td>
      <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">{row.pesiDate}</td>
      <td
        className="py-2.5 pr-3 whitespace-nowrap font-medium"
        style={{ color: urgencyColor(urgency) }}
      >
        {formatRemaining(remaining, locale, remainingLabels)}
      </td>
      <td className="py-2.5 pr-3">{row.matter || "—"}</td>
      <td
        className="py-2.5 pr-3 text-[var(--muted)] max-w-[12rem]"
        title={partiesFull || undefined}
      >
        {truncateParties(partiesFull)}
      </td>
      <td className="py-2.5">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Link
            href={`/sajilokanun/cases?case=${row.caseId}`}
            className={emiStyles.emiGlossaryLink}
          >
            {openLabel}
          </Link>
          {showRefresh ? (
            <RefreshPesiIconButton
              label={refreshLabel}
              busyLabel={refreshBusyLabel}
              busy={refreshing}
              disabled={refreshBusy}
              onClick={onRefresh}
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function ActivityRow({
  row,
  locale,
  remainingLabels,
  openLabel,
  showRefresh,
  refreshing,
  refreshBusy,
  refreshLabel,
  refreshBusyLabel,
  onRefresh,
}: {
  row: DashboardActivityRecord;
  locale: "en" | "ne";
  remainingLabels: { today: string; left: string; overdue: string };
  openLabel: string;
  showRefresh: boolean;
  refreshing: boolean;
  refreshBusy: boolean;
  refreshLabel: string;
  refreshBusyLabel: string;
  onRefresh: () => void;
}) {
  const bsDate = { year: row.bsYear, month: row.bsMonth, day: row.bsDay };
  const remaining = remainingDaysFromBs(bsDate);
  const urgency = urgencyFromRemaining(remaining);
  const court = courtLabel(row, locale);
  return (
    <tr className="border-b border-[var(--border)] align-top">
      <td className="py-2.5 pr-3">
        <div className="font-medium text-[var(--foreground)]">
          {row.caseTitle || "—"}
        </div>
        <div className="text-xs text-[var(--muted)]">
          {row.caseNo}
          {row.caseStatus ? ` · ${row.caseStatus}` : ""}
        </div>
      </td>
      <td className="py-2.5 pr-3 text-[var(--muted)]" title={court || undefined}>
        {court || "—"}
      </td>
      <td className="py-2.5 pr-3">
        <div className="font-medium">{row.labelNe}</div>
        <div className="text-xs text-[var(--muted)]">{row.labelEn}</div>
      </td>
      <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">
        {formatBsDate(bsDate, locale)}
      </td>
      <td
        className="py-2.5 pr-3 whitespace-nowrap font-medium"
        style={{ color: urgencyColor(urgency) }}
      >
        {formatRemaining(remaining, locale, remainingLabels)}
      </td>
      <td className="py-2.5 pr-3 text-[var(--muted)]">{row.note || "—"}</td>
      <td className="py-2.5">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Link
            href={`/sajilokanun/cases?case=${row.caseId}`}
            className={emiStyles.emiGlossaryLink}
          >
            {openLabel}
          </Link>
          {showRefresh ? (
            <RefreshPesiIconButton
              label={refreshLabel}
              busyLabel={refreshBusyLabel}
              busy={refreshing}
              disabled={refreshBusy}
              onClick={onRefresh}
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
}
