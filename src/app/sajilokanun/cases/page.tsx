"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CaseDetailPanel } from "@/components/sajilokanun/CaseDetailPanel";
import { SajiloKanunAppShell } from "@/components/sajilokanun/SajiloKanunAppShell";
import shellStyles from "@/components/sajilokanun/SajiloKanunAppShell.module.css";
import { useLanguage } from "@/context/LanguageContext";
import {
  createCase,
  fetchCases,
  fetchSajiloKanunMe,
  fetchTeamMembers,
  updateCase,
  type LegalCaseRecord,
  type SajiloKanunUser,
  type TeamMember,
} from "@/lib/sajilokanun-access";
import emiStyles from "@/components/user/emi.module.css";
import pageStyles from "@/app/user.module.css";

const CASE_TYPES: LegalCaseRecord["type"][] = [
  "civil",
  "criminal",
  "special_administrative",
  "constitutional_writ",
];
const CASE_STATUSES: LegalCaseRecord["status"][] = ["open", "pending", "closed"];
const PARTY_SIDES: LegalCaseRecord["partySide"][] = ["plaintiff", "defendant"];

const emptyForm = {
  title: "",
  caseNo: "",
  type: "civil" as LegalCaseRecord["type"],
  status: "open" as LegalCaseRecord["status"],
  partySide: "plaintiff" as LegalCaseRecord["partySide"],
  notes: "",
  assignedMemberIds: [] as string[],
};

const CASES_PATH = "/sajilokanun/cases";

export default function SajiloKanunCasesPage() {
  const { msg } = useLanguage();
  const t = msg.sajilokanun.cases;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<SajiloKanunUser | null>(null);
  const [cases, setCases] = useState<LegalCaseRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [members, setMembers] = useState<TeamMember[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchingList, setFetchingList] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const caseId = searchParams.get("case");
    if (caseId) {
      setSelectedCaseId(caseId);
      setShowForm(false);
    } else {
      setSelectedCaseId(null);
    }
  }, [searchParams]);

  useEffect(() => {
    const showList = () => {
      setSelectedCaseId(null);
      setShowForm(false);
    };
    window.addEventListener("sajilo-kanun:show-cases-list", showList);
    return () =>
      window.removeEventListener("sajilo-kanun:show-cases-list", showList);
  }, []);

  const typeLabels: Record<LegalCaseRecord["type"], string> = {
    civil: t.typeCivil,
    criminal: t.typeCriminal,
    special_administrative: t.typeSpecialAdministrative,
    constitutional_writ: t.typeConstitutionalWrit,
  };

  const statusLabels: Record<LegalCaseRecord["status"], string> = {
    open: t.statusOpen,
    pending: t.statusPending,
    closed: t.statusClosed,
  };

  const partyLabels: Record<LegalCaseRecord["partySide"], string> = {
    plaintiff: t.plaintiff,
    defendant: t.defendant,
    other: t.otherParty,
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchSajiloKanunMe();
        setUser(me);
        if (me.role === "admin") {
          const teamMembers = await fetchTeamMembers();
          setMembers(teamMembers.filter((m) => m.role === "member" && m.active));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.initError);
      }
    })();
  }, [t.initError]);

  const loadCases = async () => {
    setFetchingList(true);
    try {
      const res = await fetchCases({
        search: debouncedSearch,
        type: filterType,
        status: filterStatus,
        page: currentPage,
        limit: pageSize,
      });
      setCases(res.cases);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError);
    } finally {
      setFetchingList(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCases();
  }, [debouncedSearch, filterType, filterStatus, currentPage, pageSize]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(false);
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSelectedCaseId(null);
    setShowForm(true);
    if (searchParams.get("case")) {
      router.replace(CASES_PATH);
    }
  }

  function startEdit(legalCase: LegalCaseRecord) {
    setEditingId(legalCase.id);
    setForm({
      title: legalCase.title,
      caseNo: legalCase.caseNo,
      type: legalCase.type,
      status: legalCase.status,
      partySide:
        legalCase.partySide === "defendant" ? "defendant" : "plaintiff",
      notes: legalCase.notes,
      assignedMemberIds: legalCase.assignedMemberIds,
    });
    setError("");
    setSelectedCaseId(null);
    setShowForm(true);
    if (searchParams.get("case")) {
      router.replace(CASES_PATH);
    }
  }

  function openCaseDetail(legalCase: LegalCaseRecord) {
    setShowForm(false);
    setSelectedCaseId(legalCase.id);
    router.push(`${CASES_PATH}?case=${encodeURIComponent(legalCase.id)}`);
  }

  function toggleAssignee(memberId: string) {
    setForm((f) => ({
      ...f,
      assignedMemberIds: f.assignedMemberIds.includes(memberId)
        ? f.assignedMemberIds.filter((id) => id !== memberId)
        : [...f.assignedMemberIds, memberId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setError("");
    try {
      if (editingId) {
        await updateCase(editingId, form);
      } else {
        await createCase(form);
      }
      resetForm();
      await loadCases();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError);
    }
  }

  function memberNames(ids: string[]) {
    return ids
      .map((id) => members.find((m) => m.id === id)?.name ?? id)
      .join(", ");
  }

  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;

  function clearSearchAndFilters() {
    setSearchQuery("");
    setDebouncedSearch("");
    setFilterType("all");
    setFilterStatus("all");
    setCurrentPage(1);
  }

  if (loading) {
    return (
      <SajiloKanunAppShell title={t.title} subtitle={t.loading}>
        <div className={emiStyles.emiPanel}>
          <p className={pageStyles.calculatorSubtitle}>{t.loading}</p>
        </div>
      </SajiloKanunAppShell>
    );
  }

  return (
    <SajiloKanunAppShell
      title={t.title}
      subtitle={isAdmin ? t.subtitleAdmin : t.subtitleMember}
    >
      <div className={shellStyles.panelStack}>
        {error && <p className={pageStyles.contactError}>{error}</p>}

        {selectedCaseId ? (
          <CaseDetailPanel
            caseId={selectedCaseId}
            labels={t}
            typeLabels={typeLabels}
            statusLabels={statusLabels}
            partyLabels={partyLabels}
            memberNames={memberNames}
            canEdit={isAdmin}
            isFirmUser={Boolean(user?.teamId) && user?.role !== "caseUser"}
            currentUserId={user?.id ?? ""}
            onBack={() => {
              setSelectedCaseId(null);
              router.push(CASES_PATH);
              void loadCases();
            }}
            onEdit={startEdit}
          />
        ) : isAdmin && showForm ? (
          <form onSubmit={handleSubmit} className={emiStyles.emiPanel}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={emiStyles.emiPanelTitle} style={{ margin: 0 }}>
                {editingId ? t.editTitle : t.addTitle}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] px-2 py-1 rounded border border-[var(--border)]"
              >
                {t.close}
              </button>
            </div>

            <div className={emiStyles.emiField}>
              <label htmlFor="case-title">{t.titleLabel}</label>
              <input
                id="case-title"
                className={emiStyles.emiNumberInput}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t.titlePlaceholder}
                required
              />
            </div>
            <div className={emiStyles.emiField}>
              <label htmlFor="case-no">{t.caseNumberLabel}</label>
              <input
                id="case-no"
                className={emiStyles.emiNumberInput}
                value={form.caseNo}
                onChange={(e) => setForm((f) => ({ ...f, caseNo: e.target.value }))}
                placeholder={t.caseNumberPlaceholder}
                required
              />
            </div>
            <div className={emiStyles.emiField}>
              <label>{t.partySideLabel}</label>
              <p className={emiStyles.emiFieldHint} style={{ marginTop: 0 }}>
                {t.partySideHint}
              </p>
              <div className={emiStyles.emiPresets} style={{ marginTop: "0.35rem" }}>
                {PARTY_SIDES.map((side) => {
                  const active = form.partySide === side;
                  return (
                    <button
                      key={side}
                      type="button"
                      className={
                        active
                          ? `${emiStyles.emiPreset} ${emiStyles.emiPresetActive}`
                          : emiStyles.emiPreset
                      }
                      onClick={() => setForm((f) => ({ ...f, partySide: side }))}
                      aria-pressed={active}
                    >
                      {partyLabels[side]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={emiStyles.emiRow}>
              <div className={emiStyles.emiField}>
                <label htmlFor="case-type">{t.typeLabel}</label>
                <select
                  id="case-type"
                  className={emiStyles.emiNumberInput}
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as LegalCaseRecord["type"],
                    }))
                  }
                >
                  {CASE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {typeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={emiStyles.emiField}>
                <label htmlFor="case-status">{t.statusLabel}</label>
                <select
                  id="case-status"
                  className={emiStyles.emiNumberInput}
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as LegalCaseRecord["status"],
                    }))
                  }
                >
                  {CASE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={emiStyles.emiField}>
              <label htmlFor="case-notes">{t.notesLabel}</label>
              <textarea
                id="case-notes"
                className={emiStyles.emiNumberInput}
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t.notesPlaceholder}
                style={{ resize: "vertical", minHeight: "5rem" }}
              />
            </div>
            {members.length > 0 && (
              <div className={emiStyles.emiField}>
                <label>{t.assignMembers}</label>
                <div className={emiStyles.emiPresets} style={{ marginTop: "0.35rem" }}>
                  {members.map((member) => {
                    const active = form.assignedMemberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        className={
                          active
                            ? `${emiStyles.emiPreset} ${emiStyles.emiPresetActive}`
                            : emiStyles.emiPreset
                        }
                        onClick={() => toggleAssignee(member.id)}
                      >
                        {member.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className={emiStyles.emiRow} style={{ marginTop: "0.5rem" }}>
              <button type="submit" className={pageStyles.contactSubmit}>
                {editingId ? t.saveChanges : t.createCase}
              </button>
              <button
                type="button"
                className={pageStyles.skGateDemoBtn}
                onClick={resetForm}
              >
                {t.cancel}
              </button>
            </div>
          </form>
        ) : (
          <div className={emiStyles.emiPanel}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className={emiStyles.emiPanelTitle} style={{ margin: 0 }}>
                {isAdmin ? t.allCases : t.yourCases} ({totalCount})
              </h2>
              <div className="flex items-center gap-3">
                {fetchingList && (
                  <span className="text-xs text-[var(--primary)] font-medium flex items-center gap-1">
                    {t.updating}
                  </span>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={openAddForm}
                    className={pageStyles.contactSubmit}
                    style={{ padding: "0.45rem 1rem", fontSize: "0.875rem", margin: 0 }}
                  >
                    {t.addCases}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={emiStyles.emiNumberInput}
                  style={{ paddingRight: searchQuery ? "2.25rem" : "0.75rem" }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setDebouncedSearch("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] px-1.5 py-0.5 rounded"
                    title={t.clearSearch}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="w-full sm:w-56">
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={emiStyles.emiNumberInput}
                >
                  <option value="all">{t.allTypes}</option>
                  <option value="civil">{t.typeCivil}</option>
                  <option value="criminal">{t.typeCriminal}</option>
                  <option value="special_administrative">
                    {t.typeSpecialAdministrative}
                  </option>
                  <option value="constitutional_writ">
                    {t.typeConstitutionalWrit}
                  </option>
                </select>
              </div>

              <div className="w-full sm:w-36">
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={emiStyles.emiNumberInput}
                >
                  <option value="all">{t.allStatuses}</option>
                  <option value="open">{t.statusOpen}</option>
                  <option value="pending">{t.statusPending}</option>
                  <option value="closed">{t.statusClosed}</option>
                </select>
              </div>
            </div>

            <div className={shellStyles.panelStack} style={{ gap: "0.75rem" }}>
              {cases.map((legalCase) => (
                <article
                  key={legalCase.id}
                  className={emiStyles.emiFadeCard}
                  style={{ padding: "1rem", cursor: "pointer" }}
                  role="button"
                  tabIndex={0}
                  onClick={() => openCaseDetail(legalCase)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openCaseDetail(legalCase);
                    }
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <strong style={{ color: "#042c53" }}>{legalCase.title}</strong>
                      <p className={emiStyles.emiFieldHint}>
                        {t.caseNo}{" "}
                        <span className="font-mono font-semibold">{legalCase.caseNo}</span>
                        {" · "}
                        {typeLabels[legalCase.type] ?? legalCase.type}
                        {" · "}
                        <span className="font-medium">
                          {statusLabels[legalCase.status]}
                        </span>
                        {" · "}
                        <span className="font-medium">
                          {partyLabels[legalCase.partySide ?? "plaintiff"]}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={emiStyles.emiFieldHint} style={{ margin: 0 }}>
                        {t.openCase}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          className={emiStyles.emiGlossaryLink}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(legalCase);
                          }}
                        >
                          {t.edit}
                        </button>
                      )}
                    </div>
                  </div>
                  {legalCase.notes && (
                    <p
                      className={pageStyles.calculatorSubtitle}
                      style={{ marginTop: "0.5rem", marginBottom: 0 }}
                    >
                      {legalCase.notes}
                    </p>
                  )}
                  {legalCase.assignedMemberIds.length > 0 && isAdmin && (
                    <p className={emiStyles.emiFieldHint} style={{ marginTop: "0.5rem" }}>
                      {t.assigned}: {memberNames(legalCase.assignedMemberIds)}
                    </p>
                  )}
                </article>
              ))}

              {cases.length === 0 &&
                (searchQuery || filterType !== "all" || filterStatus !== "all") && (
                  <div className="py-8 text-center">
                    <p
                      className={pageStyles.calculatorSubtitle}
                      style={{ marginBottom: "0.5rem" }}
                    >
                      {t.noMatch}
                    </p>
                    <button
                      type="button"
                      onClick={clearSearchAndFilters}
                      className={emiStyles.emiGlossaryLink}
                      style={{ background: "none", border: "none", cursor: "pointer" }}
                    >
                      {t.clearFilters}
                    </button>
                  </div>
                )}

              {cases.length === 0 &&
                !searchQuery &&
                filterType === "all" &&
                filterStatus === "all" && (
                  <div className="py-6 text-center">
                    <p
                      className={pageStyles.calculatorSubtitle}
                      style={{ marginBottom: "1rem" }}
                    >
                      {t.noCasesYet}
                    </p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={openAddForm}
                        className={pageStyles.contactSubmit}
                        style={{ padding: "0.5rem 1.25rem", fontSize: "0.875rem" }}
                      >
                        {t.addCases}
                      </button>
                    )}
                  </div>
                )}
            </div>

            {totalCount > 0 && (
              <div className="mt-5 pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
                <div>
                  {t.showing} {startIndex + 1}–{Math.min(startIndex + cases.length, totalCount)}{" "}
                  {t.of}{" "}
                  <span className="font-semibold text-[var(--foreground)]">{totalCount}</span>{" "}
                  {t.casesWord}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 mr-2">
                    <span>{t.perPage}</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="border border-[var(--border)] rounded px-1.5 py-1 bg-[var(--surface)] text-[var(--foreground)] text-xs"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={activePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-muted)] transition-colors"
                  >
                    {t.prev}
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                          pageNum === activePage
                            ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={activePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-muted)] transition-colors"
                  >
                    {t.next}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SajiloKanunAppShell>
  );
}
