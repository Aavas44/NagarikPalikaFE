"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CaseDetailPanel } from "@/components/sajilokanun/CaseDetailPanel";
import { CaseRowMenu } from "@/components/sajilokanun/CaseRowMenu";
import { SheetSelect } from "@/components/sajilokanun/SheetSelect";
import { SajiloKanunAppShell } from "@/components/sajilokanun/SajiloKanunAppShell";
import shellStyles from "@/components/sajilokanun/SajiloKanunAppShell.module.css";
import { useLanguage } from "@/context/LanguageContext";
import {
  createCase,
  exportCaseFilesZip,
  extractCaseDocumentFacts,
  fetchCases,
  fetchCourtsCatalog,
  fetchSajiloKanunMe,
  fetchTeamMembers,
  fileToBase64Payload,
  isFirmQuotaError,
  updateCase,
  uploadCaseDocument,
  type CourtCategoryGroup,
  type ExtractDocumentFilePayload,
  type LegalCaseRecord,
  type SajiloKanunUser,
  type TeamMember,
} from "@/lib/sajilokanun-access";
import { FirmQuotaReachedDialog } from "@/components/sajilokanun/FirmQuotaReachedDialog";
import { CaseFamilyTree } from "@/components/sajilokanun/CaseFamilyTree";
import {
  normalizeExtractedCaseDocument,
  type ExtractedCaseDocument,
} from "@/lib/sajilokanun/document-prompts";
import { mapExtractionToCaseDraft } from "@/lib/sajilokanun/map-extraction-to-case";
import {
  COURT_TYPE_META,
  COURT_TYPES,
  courtTypeFromCategory,
  type CourtType,
} from "@/lib/sajilokanun/court-type";
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
  courtType: "" as CourtType | "",
  courtId: "",
  assignedMemberIds: [] as string[],
};

const CASES_PATH = "/sajilokanun/cases";

export default function SajiloKanunCasesPage() {
  const { locale, msg } = useLanguage();
  const t = msg.sajilokanun.cases;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<SajiloKanunUser | null>(null);
  const [cases, setCases] = useState<LegalCaseRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [courtCategories, setCourtCategories] = useState<CourtCategoryGroup[]>([]);

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
  const [exportingCaseId, setExportingCaseId] = useState<string | null>(null);
  const [quotaDialog, setQuotaDialog] = useState<{
    kind: "cases" | "documents" | "ai";
    used: number;
    limit: number;
  } | null>(null);
  const [ocrExtracting, setOcrExtracting] = useState(false);
  const [pendingExtraction, setPendingExtraction] = useState<{
    facts: ExtractedCaseDocument;
    sourceFileNames: string[];
    model: string;
    files: ExtractDocumentFilePayload[];
  } | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = user?.role === "admin";

  const courtOptions = useMemo(() => {
    const catalogCategory = form.courtType
      ? COURT_TYPE_META[form.courtType].catalogCategory
      : null;
    return courtCategories
      .filter((group) =>
        catalogCategory ? group.id === catalogCategory : true
      )
      .flatMap((group) => {
        const groupLabel =
          locale === "ne"
            ? `${group.labelNe} · ${group.labelEn}`
            : `${group.labelEn} · ${group.labelNe}`;
        return group.courts.map((court) => ({
          value: court.id,
          label: court.name,
          secondary: court.nameEn ?? undefined,
          group: groupLabel,
          searchText: [court.name, court.nameEn, group.labelEn, group.labelNe]
            .filter(Boolean)
            .join(" "),
        }));
      });
  }, [courtCategories, form.courtType, locale]);

  function formatCourtTypeLabel(courtType: CourtType | null | undefined) {
    if (!courtType) return null;
    const meta = COURT_TYPE_META[courtType];
    return locale === "ne" ? meta.labelNe : meta.labelEn;
  }

  function formatCourtLabel(legalCase: LegalCaseRecord) {
    const typeLabel = formatCourtTypeLabel(
      legalCase.courtType ?? courtTypeFromCategory(legalCase.courtCategory)
    );
    if (!legalCase.courtName && !legalCase.courtNameEn) {
      return typeLabel;
    }
    const name =
      legalCase.courtName && legalCase.courtNameEn
        ? locale === "ne"
          ? `${legalCase.courtName} · ${legalCase.courtNameEn}`
          : `${legalCase.courtNameEn} · ${legalCase.courtName}`
        : legalCase.courtName || legalCase.courtNameEn || null;
    if (typeLabel && name && !name.includes(typeLabel)) {
      return `${typeLabel} — ${name}`;
    }
    return name || typeLabel;
  }

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
          const [teamMembers, courtsCatalog] = await Promise.all([
            fetchTeamMembers(),
            fetchCourtsCatalog(),
          ]);
          setMembers(teamMembers.filter((m) => m.role === "member" && m.active));
          setCourtCategories(courtsCatalog.categories);
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
    setPendingExtraction(null);
    setShowForm(false);
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setPendingExtraction(null);
    setError("");
    setSelectedCaseId(null);
    setShowForm(true);
    if (searchParams.get("case")) {
      router.replace(CASES_PATH);
    }
  }

  function startEdit(legalCase: LegalCaseRecord) {
    setEditingId(legalCase.id);
    setPendingExtraction(null);
    setForm({
      title: legalCase.title,
      caseNo: legalCase.caseNo,
      type: legalCase.type,
      status: legalCase.status,
      partySide:
        legalCase.partySide === "defendant" ? "defendant" : "plaintiff",
      notes: legalCase.notes,
      courtType:
        legalCase.courtType ??
        courtTypeFromCategory(legalCase.courtCategory) ??
        "",
      courtId: legalCase.courtId ?? "",
      assignedMemberIds: legalCase.assignedMemberIds,
    });
    setError("");
    setSelectedCaseId(null);
    setShowForm(true);
    if (searchParams.get("case")) {
      router.replace(CASES_PATH);
    }
  }

  async function handleOcrFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError("");
    setOcrExtracting(true);
    try {
      const files = await Promise.all(
        Array.from(fileList).slice(0, 8).map((file) => fileToBase64Payload(file))
      );
      const result = await extractCaseDocumentFacts({ files });
      const facts = normalizeExtractedCaseDocument(result.extracted);
      const draft = mapExtractionToCaseDraft(facts, courtCategories);
      setForm((f) => ({
        ...f,
        title: draft.title ?? f.title,
        caseNo: draft.caseNo ?? f.caseNo,
        notes: draft.notes ?? f.notes,
        courtType: draft.courtType ?? f.courtType,
        courtId: draft.courtId ?? (draft.courtType === "supreme" ? "" : f.courtId),
      }));
      setPendingExtraction({
        facts,
        sourceFileNames: result.fileNames,
        model: result.model,
        files,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError);
    } finally {
      setOcrExtracting(false);
      if (ocrFileInputRef.current) ocrFileInputRef.current.value = "";
    }
  }

  function openCaseDetail(legalCase: LegalCaseRecord) {
    setShowForm(false);
    setSelectedCaseId(legalCase.id);
    router.push(`${CASES_PATH}?case=${encodeURIComponent(legalCase.id)}`);
  }

  async function handleExportCase(caseId: string) {
    setExportingCaseId(caseId);
    setError("");
    try {
      const { blob, fileName } = await exportCaseFilesZip(caseId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setExportingCaseId(null);
    }
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
    if (!form.courtType) {
      setError(t.courtTypeRequired);
      return;
    }
    if (form.courtType !== "supreme" && !form.courtId.trim()) {
      setError(t.courtRequired);
      return;
    }
    try {
      const payload = {
        ...form,
        courtType: form.courtType,
        courtId: form.courtType === "supreme" ? undefined : form.courtId,
        ...(editingId || !pendingExtraction
          ? {}
          : {
              documentExtraction: {
                facts: pendingExtraction.facts,
                sourceFileNames: pendingExtraction.sourceFileNames,
                model: pendingExtraction.model,
              },
            }),
      };
      if (editingId) {
        await updateCase(editingId, payload);
      } else {
        const created = await createCase(payload);
        if (pendingExtraction?.files.length) {
          const uploadErrors: string[] = [];
          for (const file of pendingExtraction.files) {
            try {
              await uploadCaseDocument(created.id, file);
            } catch (uploadErr) {
              uploadErrors.push(
                uploadErr instanceof Error ? uploadErr.message : file.fileName
              );
            }
          }
          if (uploadErrors.length) {
            console.warn("[create-case] OCR source upload issues:", uploadErrors);
          }
        }
      }
      resetForm();
      await loadCases();
    } catch (err) {
      if (isFirmQuotaError(err) && err.code === "firm_case_quota") {
        setQuotaDialog({
          kind: "cases",
          used: err.used,
          limit: err.limit,
        });
        return;
      }
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
      {quotaDialog ? (
        <FirmQuotaReachedDialog
          kind={quotaDialog.kind}
          used={quotaDialog.used}
          limit={quotaDialog.limit}
          labels={msg.sajilokanun.quotaAlert}
          onClose={() => setQuotaDialog(null)}
        />
      ) : null}
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

            {!editingId ? (
              <div className={emiStyles.emiField}>
                <label>{t.ocrUploadLabel}</label>
                <p className={emiStyles.emiFieldHint} style={{ marginTop: 0 }}>
                  {t.ocrUploadHint}
                </p>
                <input
                  ref={ocrFileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  hidden
                  onChange={(e) => void handleOcrFiles(e.target.files)}
                />
                <div className={emiStyles.emiPresets} style={{ marginTop: "0.35rem" }}>
                  <button
                    type="button"
                    className={emiStyles.emiPreset}
                    disabled={ocrExtracting}
                    onClick={() => ocrFileInputRef.current?.click()}
                  >
                    {ocrExtracting ? t.ocrExtracting : t.ocrUploadButton}
                  </button>
                  {pendingExtraction ? (
                    <button
                      type="button"
                      className={emiStyles.emiPreset}
                      onClick={() => setPendingExtraction(null)}
                    >
                      {t.ocrClear}
                    </button>
                  ) : null}
                </div>
                {pendingExtraction ? (
                  <p className={emiStyles.emiFieldHint} style={{ marginTop: "0.5rem" }}>
                    {t.ocrSuccess}{" "}
                    {t.ocrFilesSelected.replace(
                      "{n}",
                      String(pendingExtraction.sourceFileNames.length)
                    )}
                  </p>
                ) : null}
                {pendingExtraction?.facts.वंशावली.व्यक्तिहरू.length ? (
                  <div style={{ marginTop: "0.75rem" }}>
                    <CaseFamilyTree
                      tree={pendingExtraction.facts.वंशावली}
                      labels={{
                        title: t.familyTreeTitle,
                        empty: t.familyTreeEmpty,
                        generation: t.familyTreeGeneration,
                        relation: t.familyTreeRelation,
                        sidePlaintiff: t.familyTreeSidePlaintiff,
                        sideDefendant: t.familyTreeSideDefendant,
                        sideOther: t.familyTreeSideOther,
                        sourceNote: t.familyTreeSourceNote,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

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
              <label htmlFor="case-court-type">{t.courtTypeLabel}</label>
              <select
                id="case-court-type"
                className={emiStyles.emiNumberInput}
                value={form.courtType}
                required
                onChange={(e) => {
                  const courtType = e.target.value as CourtType | "";
                  setForm((f) => ({
                    ...f,
                    courtType,
                    courtId: "",
                  }));
                }}
              >
                <option value="">{t.courtTypePlaceholder}</option>
                {COURT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {locale === "ne"
                      ? COURT_TYPE_META[type].labelNe
                      : `${COURT_TYPE_META[type].labelNe} (${COURT_TYPE_META[type].labelEn})`}
                  </option>
                ))}
              </select>
              <p className={emiStyles.emiFieldHint}>{t.courtTypeHint}</p>
            </div>
            {form.courtType && form.courtType !== "supreme" ? (
              <div className={emiStyles.emiField}>
                <SheetSelect
                  label={t.courtLabel}
                  name="courtId"
                  required
                  searchable
                  value={form.courtId}
                  options={courtOptions}
                  placeholder={t.courtPlaceholder}
                  searchPlaceholder={t.courtSearchPlaceholder}
                  emptySearchLabel={t.courtSearchEmpty}
                  onChange={(courtId) => setForm((f) => ({ ...f, courtId }))}
                />
                <p className={emiStyles.emiFieldHint}>{t.courtHint}</p>
              </div>
            ) : form.courtType === "supreme" ? (
              <p className={emiStyles.emiFieldHint}>
                {t.supremeCourtFixedHint}
              </p>
            ) : null}
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
                        {legalCase.courtName || legalCase.courtNameEn ? (
                          <>
                            {" · "}
                            <span className="font-medium">
                              {formatCourtLabel(legalCase)}
                            </span>
                          </>
                        ) : null}
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
                      <CaseRowMenu
                        menuLabel={t.caseMenu}
                        exportLabel={t.exportCase}
                        exportingLabel={t.exportingCase}
                        exporting={exportingCaseId === legalCase.id}
                        disabled={exportingCaseId !== null}
                        onExport={() => void handleExportCase(legalCase.id)}
                      />
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
