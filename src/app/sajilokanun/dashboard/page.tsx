"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SajiloKanunAppShell } from "@/components/sajilokanun/SajiloKanunAppShell";
import shellStyles from "@/components/sajilokanun/SajiloKanunAppShell.module.css";
import caseChatStyles from "@/components/sajilokanun/CaseChat.module.css";
import { useLanguage } from "@/context/LanguageContext";
import {
  fetchFirmActivityDashboard,
  fetchFirmUnreadMessages,
  type DashboardActivityRecord,
  type DashboardActivityUrgency,
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

export default function SajiloKanunDashboardPage() {
  const { locale, msg } = useLanguage();
  const t = msg.sajilokanun.dashboard;
  const [data, setData] = useState<FirmActivityDashboard | null>(null);
  const [unread, setUnread] = useState<FirmUnreadMessages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("actionable");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchFirmActivityDashboard()
      .then((activities) => {
        if (!cancelled) {
          setData(activities);
          setError("");
        }
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

  const filtered = useMemo(() => {
    const rows = data?.activities ?? [];
    return rows.filter((row) => {
      if (typeFilter !== "all" && row.activityType !== typeFilter) return false;
      if (filter === "all") return true;
      if (filter === "overdue") return row.urgency === "overdue";
      if (filter === "today") return row.urgency === "today";
      if (filter === "week") return row.urgency === "today" || row.urgency === "week";
      if (filter === "actionable") {
        return (
          row.urgency === "overdue" ||
          row.urgency === "today" ||
          row.urgency === "week"
        );
      }
      return true;
    });
  }, [data, filter, typeFilter]);

  const remainingLabels = {
    today: t.remainingToday,
    left: t.remainingLeft,
    overdue: t.remainingOverdue,
  };

  return (
    <SajiloKanunAppShell title={t.title} subtitle={t.subtitle}>
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
          ) : filtered.length === 0 ? (
            <p className={pageStyles.calculatorSubtitle}>{t.empty}</p>
          ) : (
            <>
              <div className={caseChatStyles.activityTableWrap}>
                <table className={caseChatStyles.activityTable}>
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                      <th className="pb-2 pr-3 font-medium">{t.colCase}</th>
                      <th className="pb-2 pr-3 font-medium">{t.colActivity}</th>
                      <th className="pb-2 pr-3 font-medium">{t.colDate}</th>
                      <th className="pb-2 pr-3 font-medium">{t.colRemaining}</th>
                      <th className="pb-2 pr-3 font-medium">{t.colNote}</th>
                      <th className="pb-2 font-medium">{t.colActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <ActivityRow
                        key={row.id}
                        row={row}
                        locale={locale}
                        remainingLabels={remainingLabels}
                        openLabel={t.openCase}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={caseChatStyles.activityCards}>
                {filtered.map((row) => {
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
                      <div className={caseChatStyles.activityCardRow}>
                        <div>
                          <p className={caseChatStyles.activityCardLabel}>{t.colActivity}</p>
                          <p className={caseChatStyles.activityCardValue}>
                            {row.labelNe} ({row.labelEn})
                          </p>
                        </div>
                        <div>
                          <p className={caseChatStyles.activityCardLabel}>{t.colRemaining}</p>
                          <p
                            className={caseChatStyles.activityCardValue}
                            style={{
                              fontWeight: 600,
                              color: urgencyColor(row.urgency),
                            }}
                          >
                            {formatRemaining(remaining, locale, remainingLabels)}
                          </p>
                        </div>
                      </div>
                      <div className={caseChatStyles.activityCardRow}>
                        <div>
                          <p className={caseChatStyles.activityCardLabel}>{t.colDate}</p>
                          <p className={caseChatStyles.activityCardValue}>
                            {formatBsDate(bsDate, locale)}
                          </p>
                        </div>
                        <Link
                          href={`/sajilokanun/cases?case=${row.caseId}`}
                          className={emiStyles.emiGlossaryLink}
                        >
                          {t.openCase}
                        </Link>
                      </div>
                      {row.note ? (
                        <p className={pageStyles.calculatorSubtitle} style={{ marginTop: "0.5rem" }}>
                          {row.note}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
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

function ActivityRow({
  row,
  locale,
  remainingLabels,
  openLabel,
}: {
  row: DashboardActivityRecord;
  locale: "en" | "ne";
  remainingLabels: { today: string; left: string; overdue: string };
  openLabel: string;
}) {
  const bsDate = { year: row.bsYear, month: row.bsMonth, day: row.bsDay };
  const remaining = remainingDaysFromBs(bsDate);
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
      <td className="py-2.5 pr-3">
        <div className="font-medium">{row.labelNe}</div>
        <div className="text-xs text-[var(--muted)]">{row.labelEn}</div>
      </td>
      <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">
        {formatBsDate(bsDate, locale)}
      </td>
      <td
        className="py-2.5 pr-3 whitespace-nowrap font-medium"
        style={{ color: urgencyColor(row.urgency) }}
      >
        {formatRemaining(remaining, locale, remainingLabels)}
      </td>
      <td className="py-2.5 pr-3 text-[var(--muted)]">{row.note || "—"}</td>
      <td className="py-2.5">
        <Link
          href={`/sajilokanun/cases?case=${row.caseId}`}
          className={emiStyles.emiGlossaryLink}
        >
          {openLabel}
        </Link>
      </td>
    </tr>
  );
}
