"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addCasePayment,
  CASE_ACTIVITY_TYPES,
  createCaseActivity,
  createCaseParticipant,
  deleteCaseActivity,
  deleteCasePayment,
  deleteCaseUpload,
  downloadCaseUpload,
  openCaseUploadInBrowser,
  fetchCaseActivities,
  fetchCaseDetail,
  fetchCaseMessages,
  fetchCaseParticipants,
  fetchCasePesiRows,
  fetchCaseUploads,
  fetchSupremeCourtPesiForCase,
  extractCaseDocumentFacts,
  saveCaseDocumentExtraction,
  fileToBase64Payload,
  blobToBase64Payload,
  fetchCaseUploadBlob,
  fetchSkDocumentTemplates,
  fetchSajiloKanunMe,
  setSkStarredDocumentTemplate,
  saveGeneratedDocumentToCaseFiles,
  isFirmQuotaError,
  markCaseMessagesRead,
  removeCaseParticipant,
  renameCaseUpload,
  sendCaseMessage,
  uploadCaseDocument,
  type CaseActivityRecord,
  type CaseActivityType,
  type CaseChatMessage,
  type CaseParticipantRecord,
  type CasePesiColumn,
  type CasePesiRowRecord,
  type SkPublishedDocumentTemplate,
  type CaseUploadedDocumentRecord,
  type LegalCaseDetail,
  type LegalCaseRecord,
} from "@/lib/sajilokanun-access";
import {
  emptyExtractedCaseDocument,
  emptyExtractedParty,
  normalizeExtractedCaseDocument,
  type ExtractedCaseDocument,
} from "@/lib/sajilokanun/document-prompts";
import {
  bsToAd,
  daysBetweenAd,
  formatBsDate,
  getTodayBs,
  type BsDate,
} from "@/lib/nepaliCalendar";
import { toDevanagariDigits } from "@/lib/sajilokanun/nepali-digits";
import { matchesNepaliRomanSearch } from "@/lib/sajilokanun/nepali-roman-search";
import { sortStarredFirst, toggleStarredId } from "@/lib/starred-templates";
import { COURT_TYPE_META } from "@/lib/sajilokanun/court-type";
import { useLanguage } from "@/context/LanguageContext";
import { NepaliDatePicker } from "@/components/sajilokanun/NepaliDatePicker";
import { SheetSelect } from "@/components/sajilokanun/SheetSelect";
import { TemplateStarChip } from "@/components/TemplateStarChip";
import emiStyles from "@/components/user/emi.module.css";
import pageStyles from "@/app/user.module.css";
import shellStyles from "@/components/sajilokanun/SajiloKanunAppShell.module.css";
import chatStyles from "@/components/sajilokanun/ChatMessage.module.css";
import caseChatStyles from "@/components/sajilokanun/CaseChat.module.css";
import { CaseFilePreviewPanel } from "@/components/sajilokanun/CaseFilePreviewPanel";
import { CaseDocumentModal } from "@/components/sajilokanun/CaseDocumentModal";
import { CaseFamilyTree } from "@/components/sajilokanun/CaseFamilyTree";
import { FirmQuotaReachedDialog } from "@/components/sajilokanun/FirmQuotaReachedDialog";
import { StatusToast } from "@/components/sajilokanun/StatusToast";

type CasesCopy = {
  backToList: string;
  edit: string;
  caseNo: string;
  openCase: string;
  detailLoading: string;
  detailError: string;
  overview: string;
  notesLabel: string;
  assigned: string;
  deleteItem: string;
  caseUsersTitle: string;
  caseUsersHint: string;
  contactNameLabel: string;
  contactNamePlaceholder: string;
  contactPhoneLabel: string;
  contactPhonePlaceholder: string;
  testimonialContentLabel: string;
  testimonialContentPlaceholder: string;
  caseUserPasswordLabel: string;
  caseUserPasswordPlaceholder: string;
  caseUserEmailLabel: string;
  caseUserEmailPlaceholder: string;
  addCaseUser: string;
  noCaseUsers: string;
  removeCaseUser: string;
  chatTitle: string;
  chatHint: string;
  chatEmpty: string;
  chatPlaceholder: string;
  chatSend: string;
  chatYou: string;
  chatFirm: string;
  chatClient: string;
  chatLoading: string;
  chatLoadMore: string;
  cancelCreateUser: string;
  createUserButton: string;
  tabMessages: string;
  unreadMessagesBadge: string;
  tabUsers: string;
  tabPayments: string;
  tabDocuments: string;
  tabDocumentGenerator: string;
  tabActivity: string;
  tabFamilyTree: string;
  activityTitle: string;
  activityHint: string;
  activityTypeLabel: string;
  activityDateLabel: string;
  activityNoteLabel: string;
  activityNotePlaceholder: string;
  addActivity: string;
  cancelAddActivity: string;
  fetchPesi: string;
  fetchPesiBusy: string;
  fetchPesiHint: string;
  fetchPesiNoCourt: string;
  fetchPesiMatched: string;
  fetchPesiNone: string;
  pesiTableTitle: string;
  pesiColDate: string;
  noPesiRows: string;
  deleteActivityConfirm: string;
  noActivities: string;
  activityAddedBy: string;
  activityColType: string;
  activityColDate: string;
  activityColRemaining: string;
  activityColNote: string;
  activityColAddedBy: string;
  activityColActions: string;
  activityToday: string;
  activityDaysLeft: string;
  activityDaysOverdue: string;
  activityCaseRegistration: string;
  activityNoticeService: string;
  activityReplyFiling: string;
  activityHearingDate: string;
  activityWitnessTestimony: string;
  bsYear: string;
  bsMonth: string;
  bsDay: string;
  documentsTitle: string;
  documentsHint: string;
  uploadButton: string;
  uploading: string;
  noUploads: string;
  downloadUpload: string;
  previewUpload: string;
  previewingUpload: string;
  previewUnsupported: string;
  editUpload: string;
  saveUpload: string;
  savingUpload: string;
  cancelEditUpload: string;
  editUploadHint: string;
  uploadSaved: string;
  loadingPreview: string;
  closePreview: string;
  renameUpload: string;
  renamingUpload: string;
  saveRenameUpload: string;
  cancelRenameUpload: string;
  removeUpload: string;
  uploadTooLarge: string;
  uploadInvalidType: string;
  paymentsTitle: string;
  paymentsHint: string;
  paymentsHintClient: string;
  amountLabel: string;
  currencyLabel: string;
  methodLabel: string;
  methodPlaceholder: string;
  paymentNoteLabel: string;
  paymentNotePlaceholder: string;
  paidAtLabel: string;
  addPayment: string;
  noPayments: string;
  totalPaid: string;
  documentGeneratorTitle: string;
  documentGeneratorHint: string;
  documentTemplatesSearch: string;
  documentTemplatesEmpty: string;
  documentTemplatesNoCourtType: string;
  documentTemplatesLoading: string;
  documentTemplatesSelected: string;
  documentTemplatesFillSoon: string;
  documentTemplatesCount: string;
  generateDocument: string;
  generating: string;
  noDocuments: string;
  docPlaceholderBadge: string;
  docReadyBadge: string;
  docFiradpatra: string;
  docPratiuttarapatra: string;
  docVakalatnama: string;
  docWarisnama: string;
  docNivedanAwedan: string;
  docAdhikritWarisnama: string;
  docSadharanWarisnama: string;
  docManjurinama: string;
  docSampattiRokkaNivedan: string;
  docSampattiFukuwaNivedan: string;
  docTayariFatbariNivedan: string;
  docCourtFeeSubidhaNivedan: string;
  docMilisJhikauneNivedan: string;
  docPetboliManishBhujiNivedan: string;
  docSakkalKagajPeshNivedan: string;
  docHajirHunaAayekoNivedan: string;
  docGroupPleadings: string;
  docGroupGeneral: string;
  docGroupPetitions: string;
  comingSoonAi: string;
  documentExtractorTitle: string;
  documentExtractorHint: string;
  extractorPickUploads: string;
  extractorAddFiles: string;
  extractorNoFiles: string;
  extractorGenerate: string;
  extractorExtracting: string;
  extractorResultTitle: string;
  extractorCopyJson: string;
  extractorCopied: string;
  extractorClear: string;
  extractorSave: string;
  extractorSaving: string;
  extractorSaved: string;
  extractorSavedTitle: string;
  extractorUnsavedTitle: string;
  extractorEditHint: string;
  extractorLastSaved: string;
  extractorAddDefendant: string;
  extractorRemoveDefendant: string;
  extractorDefendantN: string;
  extractorAddPlaintiff: string;
  extractorRemovePlaintiff: string;
  extractorPlaintiffN: string;
  extractorPlaintiffsTitle: string;
  extractorDefendantsTitle: string;
  familyTreeTitle: string;
  familyTreeEmpty: string;
  familyTreeGeneration: string;
  familyTreeRelation: string;
  familyTreeSidePlaintiff: string;
  familyTreeSideDefendant: string;
  familyTreeSideOther: string;
  familyTreeSourceNote: string;
  docFormTitle: string;
  docFormHint: string;
  docCourtName: string;
  docPlaintiffName: string;
  docDefendantName: string;
  docCaseType: string;
  docCaseNo: string;
  docDefendantFullName: string;
  docDefendantParents: string;
  docDefendantAddress: string;
  docDefendantAgeId: string;
  docAllegationPoints: string;
  docAllegationCharge: string;
  docAllegationDefense: string;
  docAddAllegation: string;
  docRemoveAllegation: string;
  docLegalGrounds: string;
  docReliefClaimed: string;
  docAttachedEvidence: string;
  docDate: string;
  docCancelDraft: string;
  docGenerateReply: string;
  docNivedanFormTitle: string;
  docNivedanFormHint: string;
  docNivedanPetitionType: string;
  docNivedanInjunction: string;
  docNivedanBail: string;
  docNivedanStay: string;
  docNivedanDeadline: string;
  docPetitionerName: string;
  docPetitionerParents: string;
  docPetitionerAddress: string;
  docPetitionerAgeId: string;
  docOpponentName: string;
  docOpponentAddress: string;
  docFacts: string;
  docGenerateNivedan: string;
  docAdhikritFormTitle: string;
  docAdhikritFormHint: string;
  docSadharanFormTitle: string;
  docSadharanFormHint: string;
  docManjuriFormTitle: string;
  docManjuriFormHint: string;
  docPrincipalName: string;
  docPrincipalAge: string;
  docPrincipalParents: string;
  docPrincipalAddress: string;
  docPrincipalCitizenship: string;
  docAttorneyName: string;
  docAttorneyAge: string;
  docAttorneyParents: string;
  docAttorneyAddress: string;
  docAttorneyCitizenship: string;
  docRelationship: string;
  docPurpose: string;
  docPowers: string;
  docPropertyDetails: string;
  docAuthenticationPlace: string;
  docValidityPeriod: string;
  docWitness1: string;
  docWitness2: string;
  docWitnessName: string;
  docWitnessAddress: string;
  docWitnessCitizenship: string;
  docConsenterName: string;
  docConsenterAge: string;
  docConsenterParents: string;
  docConsenterAddress: string;
  docConsenterCitizenship: string;
  docBeneficiaryName: string;
  docBeneficiaryAddress: string;
  docConsentSubject: string;
  docConsentConditions: string;
  docGenerateAdhikrit: string;
  docGenerateSadharan: string;
  docGenerateManjuri: string;
  saveToCaseFiles: string;
  savingToCaseFiles: string;
  savedToCaseFiles: string;
  saveToCaseFilesAgain: string;
};

const ACTIVITY_LABEL_KEYS: Record<
  CaseActivityType,
  | "activityCaseRegistration"
  | "activityNoticeService"
  | "activityReplyFiling"
  | "activityHearingDate"
  | "activityWitnessTestimony"
> = {
  case_registration: "activityCaseRegistration",
  notice_service: "activityNoticeService",
  reply_filing: "activityReplyFiling",
  hearing_date: "activityHearingDate",
  witness_testimony: "activityWitnessTestimony",
};

const TEMPLATE_PAGE_SIZE = 20;

function todayInputValue() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "NPR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NPR"} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function mergePesiRows(
  existing: CasePesiRowRecord[],
  incoming: CasePesiRowRecord[]
): CasePesiRowRecord[] {
  const byId = new Map<string, CasePesiRowRecord>();
  for (const row of existing) byId.set(row.id, row);
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => {
    const dateCmp = b.pesiDate.localeCompare(a.pesiDate);
    if (dateCmp !== 0) return dateCmp;
    return b.id.localeCompare(a.id);
  });
}

function remainingDaysFromBs(bs: BsDate, todayBs: BsDate = getTodayBs()) {
  return daysBetweenAd(bsToAd(todayBs), bsToAd(bs));
}

function formatRemainingDays(
  days: number,
  labels: { activityToday: string; activityDaysLeft: string; activityDaysOverdue: string },
  locale: "en" | "ne" = "en"
) {
  const n =
    locale === "ne"
      ? toDevanagariDigits(String(Math.abs(days)))
      : String(Math.abs(days));
  if (days === 0) return labels.activityToday;
  if (days > 0) return labels.activityDaysLeft.replace("{n}", n);
  return labels.activityDaysOverdue.replace("{n}", n);
}

export function CaseDetailPanel({
  caseId,
  labels,
  typeLabels,
  statusLabels,
  partyLabels,
  memberNames,
  canEdit,
  isFirmUser,
  currentUserId,
  onBack,
  onEdit,
}: {
  caseId: string;
  labels: CasesCopy;
  typeLabels: Record<LegalCaseRecord["type"], string>;
  statusLabels: Record<LegalCaseRecord["status"], string>;
  partyLabels: Record<LegalCaseRecord["partySide"], string>;
  memberNames: (ids: string[]) => string;
  canEdit: boolean;
  isFirmUser: boolean;
  currentUserId: string;
  onBack: () => void;
  onEdit: (legalCase: LegalCaseRecord) => void;
}) {
  const t = labels;
  const { locale, msg } = useLanguage();
  const [detail, setDetail] = useState<LegalCaseDetail | null>(null);
  const [participants, setParticipants] = useState<CaseParticipantRecord[]>([]);
  const [messages, setMessages] = useState<CaseChatMessage[]>([]);
  const [unreadFromClient, setUnreadFromClient] = useState(0);
  const [activities, setActivities] = useState<CaseActivityRecord[]>([]);
  const [pesiRows, setPesiRows] = useState<CasePesiRowRecord[]>([]);
  const [pesiColumns, setPesiColumns] = useState<CasePesiColumn[]>([]);
  const [fetchingPesi, setFetchingPesi] = useState(false);
  const [pesiToast, setPesiToast] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(true);
  const [error, setError] = useState("");
  const [quotaDialog, setQuotaDialog] = useState<{
    kind: "cases" | "documents" | "ai";
    used: number;
    limit: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [visibleMessageCount, setVisibleMessageCount] = useState(3);
  const [courtTemplates, setCourtTemplates] = useState<SkPublishedDocumentTemplate[]>(
    []
  );
  const [courtTemplatesLoading, setCourtTemplatesLoading] = useState(false);
  const [courtTemplatesError, setCourtTemplatesError] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePage, setTemplatePage] = useState(1);
  const [activeFormTemplate, setActiveFormTemplate] =
    useState<SkPublishedDocumentTemplate | null>(null);
  const [starredTemplateIds, setStarredTemplateIds] = useState<string[]>([]);
  const starLock = useRef(new Set<string>());
  const [savingDocId, setSavingDocId] = useState<string | null>(null);
  const [extractSelectedUploadIds, setExtractSelectedUploadIds] = useState<string[]>(
    []
  );
  const [extractLocalFiles, setExtractLocalFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractEditForm, setExtractEditForm] = useState<ExtractedCaseDocument>(
    emptyExtractedCaseDocument()
  );
  const [extractHasDraft, setExtractHasDraft] = useState(false);
  const [extractIsSaved, setExtractIsSaved] = useState(false);
  const [extractDirty, setExtractDirty] = useState(false);
  const [extractSaving, setExtractSaving] = useState(false);
  const [extractMeta, setExtractMeta] = useState<{
    model: string;
    fileNames: string[];
    updatedAt?: string;
  } | null>(null);
  const [extractCopied, setExtractCopied] = useState(false);
  const extractFileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "messages"
    | "users"
    | "documents"
    | "generator"
    | "payments"
    | "activity"
    | "family"
  >("messages");
  const [showUserForm, setShowUserForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [uploads, setUploads] = useState<CaseUploadedDocumentRecord[]>([]);
  const [canUploadFiles, setCanUploadFiles] = useState(true);
  const [canManageFiles, setCanManageFiles] = useState(false);
  const [maxUploadBytes, setMaxUploadBytes] = useState(10 * 1024 * 1024);
  const [uploadAccept, setUploadAccept] = useState(
    ".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.csv,.ppt,.pptx"
  );
  const [uploading, setUploading] = useState(false);
  const [previewingUploadId, setPreviewingUploadId] = useState<string | null>(null);
  const [renamingUploadId, setRenamingUploadId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [filePreview, setFilePreview] = useState<{
    url: string;
    title: string;
    mimeType: string;
    previewable: boolean;
    uploadId: string;
  } | null>(null);
  const chatWindowRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const stickMessagesToBottomRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filePreviewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (filePreviewUrlRef.current) {
        URL.revokeObjectURL(filePreviewUrlRef.current);
        filePreviewUrlRef.current = null;
      }
    };
  }, []);

  function closeFilePreview() {
    if (filePreviewUrlRef.current) {
      URL.revokeObjectURL(filePreviewUrlRef.current);
      filePreviewUrlRef.current = null;
    }
    setFilePreview(null);
  }

  async function handlePreviewUpload(item: CaseUploadedDocumentRecord) {
    if (!detail) return;
    setPreviewingUploadId(item.id);
    setError("");
    try {
      const opened = await openCaseUploadInBrowser(
        detail.id,
        item.id,
        item.fileName,
        item.mimeType
      );
      if (filePreviewUrlRef.current) {
        URL.revokeObjectURL(filePreviewUrlRef.current);
      }
      // Keep blob URL only while the in-app panel is open — never window.open,
      // which forces a download for many document types.
      filePreviewUrlRef.current = opened.previewable ? opened.url : null;
      if (!opened.previewable) {
        URL.revokeObjectURL(opened.url);
      }
      setFilePreview({
        url: opened.previewable ? opened.url : "",
        title: item.fileName,
        mimeType: opened.mimeType,
        previewable: opened.previewable,
        uploadId: item.id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setPreviewingUploadId(null);
    }
  }

  const [userForm, setUserForm] = useState({
    name: "",
    username: "",
    password: "",
    contactNo: "",
    email: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    currency: "NPR",
    method: "",
    note: "",
    paidAt: todayInputValue(),
  });
  const [activityForm, setActivityForm] = useState<{
    activityType: CaseActivityType;
    bsDate: BsDate;
    note: string;
  }>({
    activityType: "case_registration",
    bsDate: getTodayBs(),
    note: "",
  });

  async function loadDetail() {
    setLoading(true);
    try {
      const data = await fetchCaseDetail(caseId);
      setDetail(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setLoading(false);
    }
  }

  async function loadParticipants() {
    try {
      const rows = await fetchCaseParticipants(caseId);
      setParticipants(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    }
  }

  async function loadMessages(markRead = false) {
    setChatLoading(true);
    try {
      const data = await fetchCaseMessages(caseId, { markRead });
      setMessages(data.messages);
      setUnreadFromClient(markRead ? 0 : data.unreadFromClient);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setChatLoading(false);
    }
  }

  async function loadUploads() {
    try {
      const data = await fetchCaseUploads(caseId);
      setUploads(data.uploads);
      setMaxUploadBytes(data.maxBytes || 10 * 1024 * 1024);
      if (data.accept) setUploadAccept(data.accept);
      setCanUploadFiles(data.capabilities.canUpload);
      setCanManageFiles(data.capabilities.canManageFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    }
  }

  async function loadActivities() {
    try {
      const rows = await fetchCaseActivities(caseId);
      setActivities(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    }
  }

  async function loadPesiRows() {
    try {
      const data = await fetchCasePesiRows(caseId);
      setPesiRows(data.rows);
      setPesiColumns(data.columns ?? []);
    } catch {
      // Keep any rows already on screen if a later reload fails
    }
  }

  async function handleFetchPesi() {
    if (!detail) return;
    if (typeof detail.courtScDailyId !== "number") {
      setError(t.fetchPesiNoCourt);
      return;
    }
    setFetchingPesi(true);
    setError("");
    setPesiToast(null);
    try {
      const data = await fetchSupremeCourtPesiForCase(detail.id);
      try {
        const stored = await fetchCasePesiRows(detail.id);
        setPesiRows(mergePesiRows(stored.rows, data.rows ?? []));
        setPesiColumns(stored.columns ?? data.columns ?? []);
      } catch {
        setPesiRows((prev) => mergePesiRows(prev, data.rows ?? []));
        if (data.columns?.length) setPesiColumns(data.columns);
      }
      if ((data.matchedCount ?? 0) > 0) {
        setPesiToast({
          tone: "success",
          message: t.fetchPesiMatched
            .replace("{n}", String(data.matchedCount))
            .replace("{total}", String(data.totalRowsScanned ?? "—")),
        });
      } else {
        setPesiToast({
          tone: "error",
          message: t.fetchPesiNone,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t.detailError;
      setError(message);
      setPesiToast({ tone: "error", message });
    } finally {
      setFetchingPesi(false);
    }
  }

  useEffect(() => {
    setActiveTab("messages");
    setShowUserForm(false);
    setShowActivityForm(false);
    setUnreadFromClient(0);
    setVisibleMessageCount(3);
    stickMessagesToBottomRef.current = true;
    setActivityForm({
      activityType: "case_registration",
      bsDate: getTodayBs(),
      note: "",
    });
    void loadDetail();
    void loadParticipants();
    // Firm users land on Messages by default — mark read while loading.
    void loadMessages(isFirmUser);
    void loadUploads();
    void loadActivities();
    void loadPesiRows();
    setPesiToast(null);
    setExtractEditForm(emptyExtractedCaseDocument());
    setExtractHasDraft(false);
    setExtractIsSaved(false);
    setExtractDirty(false);
    setExtractMeta(null);
    setExtractLocalFiles([]);
    setExtractSelectedUploadIds([]);
    setCourtTemplates([]);
    setCourtTemplatesError("");
    setTemplateSearch("");
    setTemplatePage(1);
    setActiveFormTemplate(null);
  }, [caseId, isFirmUser]);

  useEffect(() => {
    if (!isFirmUser || !detail?.courtType) {
      setCourtTemplates([]);
      setCourtTemplatesLoading(false);
      setCourtTemplatesError("");
      return;
    }
    let cancelled = false;
    setCourtTemplatesLoading(true);
    setCourtTemplatesError("");
    void fetchSkDocumentTemplates(detail.courtType)
      .then((list) => {
        if (cancelled) return;
        setCourtTemplates(list);
        setTemplatePage(1);
        setActiveFormTemplate(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setCourtTemplates([]);
        setCourtTemplatesError(
          err instanceof Error ? err.message : t.detailError
        );
      })
      .finally(() => {
        if (!cancelled) setCourtTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detail?.courtType, detail?.id, isFirmUser, t.detailError]);

  useEffect(() => {
    if (!isFirmUser) {
      setStarredTemplateIds([]);
      return;
    }
    let cancelled = false;
    void fetchSajiloKanunMe()
      .then((me) => {
        if (cancelled) return;
        setStarredTemplateIds(me.starredDocumentTemplateIds ?? []);
      })
      .catch(() => {
        if (!cancelled) setStarredTemplateIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isFirmUser]);

  useEffect(() => {
    const saved = detail?.documentExtraction;
    if (!saved?.facts) return;
    setExtractEditForm(normalizeExtractedCaseDocument(saved.facts));
    setExtractHasDraft(true);
    setExtractIsSaved(true);
    setExtractDirty(false);
    setExtractMeta({
      model: saved.model || "",
      fileNames: saved.sourceFileNames ?? [],
      updatedAt: saved.updatedAt,
    });
  }, [detail?.id, detail?.documentExtraction?.updatedAt]);

  useEffect(() => {
    if (activeTab !== "messages" || !isFirmUser) return;
    void (async () => {
      try {
        await markCaseMessagesRead(caseId);
        setUnreadFromClient(0);
      } catch {
        // Non-blocking: unread badge may remain until next refresh.
      }
    })();
  }, [activeTab, caseId, isFirmUser]);

  useEffect(() => {
    if (activeTab === "messages") {
      stickMessagesToBottomRef.current = true;
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "messages" || chatLoading || !stickMessagesToBottomRef.current) {
      return;
    }
    const windowEl = chatWindowRef.current;
    if (windowEl) {
      windowEl.scrollTop = windowEl.scrollHeight;
    }
    // Bring the composer / latest messages into view on the page.
    const frame = window.requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, caseId, chatLoading, messages.length]);

  const totalPaid = useMemo(() => {
    if (!detail?.payments) return 0;
    return detail.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  }, [detail]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !canEdit) return;
    setBusy(true);
    setError("");
    try {
      const created = await createCaseParticipant(detail.id, userForm);
      setParticipants((prev) => [created, ...prev]);
      setUserForm({
        name: "",
        username: "",
        password: "",
        contactNo: "",
        email: "",
      });
      setShowUserForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveUser(participantId: string) {
    if (!detail || !canEdit) return;
    setBusy(true);
    setError("");
    try {
      await removeCaseParticipant(detail.id, participantId);
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !draft.trim()) return;
    setSending(true);
    setError("");
    try {
      const message = await sendCaseMessage(detail.id, draft.trim());
      stickMessagesToBottomRef.current = true;
      setMessages((prev) => [...prev, message]);
      setVisibleMessageCount((count) => Math.max(count, 3));
      setDraft("");
      if (isFirmUser) {
        try {
          await markCaseMessagesRead(detail.id, message.id);
          setUnreadFromClient(0);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setSending(false);
    }
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !isFirmUser) return;
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError(t.detailError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await addCasePayment(detail.id, {
        amount,
        currency: paymentForm.currency,
        method: paymentForm.method,
        note: paymentForm.note,
        paidAt: paymentForm.paidAt
          ? new Date(`${paymentForm.paidAt}T12:00:00`).toISOString()
          : undefined,
      });
      setDetail(next);
      setPaymentForm({
        amount: "",
        currency: "NPR",
        method: "",
        note: "",
        paidAt: todayInputValue(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePayment(itemId: string) {
    if (!detail || !isFirmUser) return;
    setBusy(true);
    setError("");
    try {
      const next = await deleteCasePayment(detail.id, itemId);
      setDetail(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      const ad = bsToAd(activityForm.bsDate);
      const created = await createCaseActivity(detail.id, {
        activityType: activityForm.activityType,
        bsYear: activityForm.bsDate.year,
        bsMonth: activityForm.bsDate.month,
        bsDay: activityForm.bsDate.day,
        activityDate: ad.toISOString(),
        note: activityForm.note,
      });
      setActivities((prev) => [created, ...prev]);
      setActivityForm({
        activityType: "case_registration",
        bsDate: getTodayBs(),
        note: "",
      });
      setShowActivityForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteActivity(activityId: string) {
    if (!detail) return;
    const item = activities.find((a) => a.id === activityId);
    if (!item) return;
    const canDelete =
      isFirmUser || item.createdBy === currentUserId;
    if (!canDelete) return;
    if (!window.confirm(t.deleteActivityConfirm)) return;

    setBusy(true);
    setError("");
    try {
      await deleteCaseActivity(detail.id, activityId);
      setActivities((prev) => prev.filter((a) => a.id !== activityId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setBusy(false);
    }
  }

  async function handleExtractDocuments() {
    if (!detail || !isFirmUser) return;
    if (extractSelectedUploadIds.length === 0 && extractLocalFiles.length === 0) {
      setError(t.extractorNoFiles);
      return;
    }
    setExtracting(true);
    setError("");
    setExtractCopied(false);
    try {
      const payloads = [];
      for (const uploadId of extractSelectedUploadIds) {
        const item = uploads.find((u) => u.id === uploadId);
        if (!item) continue;
        const blob = await fetchCaseUploadBlob(detail.id, item.id);
        payloads.push(
          await blobToBase64Payload(blob, item.fileName, item.mimeType)
        );
      }
      for (const file of extractLocalFiles) {
        payloads.push(await fileToBase64Payload(file));
      }
      const result = await extractCaseDocumentFacts({ files: payloads });
      setExtractEditForm(normalizeExtractedCaseDocument(result.extracted));
      setExtractHasDraft(true);
      setExtractIsSaved(false);
      setExtractDirty(true);
      setExtractMeta({
        model: result.model,
        fileNames: result.fileNames,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setExtracting(false);
    }
  }

  async function handleSaveExtraction() {
    if (!detail || !isFirmUser || !extractHasDraft) return;
    setExtractSaving(true);
    setError("");
    try {
      const facts = normalizeExtractedCaseDocument(extractEditForm);
      const next = await saveCaseDocumentExtraction(detail.id, {
        facts,
        sourceFileNames: extractMeta?.fileNames ?? [],
        model: extractMeta?.model ?? "",
      });
      setDetail(next);
      setExtractEditForm(
        normalizeExtractedCaseDocument(next.documentExtraction?.facts ?? facts)
      );
      setExtractIsSaved(true);
      setExtractDirty(false);
      setExtractMeta({
        model: next.documentExtraction?.model || extractMeta?.model || "",
        fileNames:
          next.documentExtraction?.sourceFileNames ?? extractMeta?.fileNames ?? [],
        updatedAt: next.documentExtraction?.updatedAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setExtractSaving(false);
    }
  }

  function patchExtraction(updater: (current: ExtractedCaseDocument) => ExtractedCaseDocument) {
    setExtractEditForm((current) => updater(current));
    setExtractDirty(true);
  }

  async function handleSaveGeneratedToFiles(documentId: string) {
    if (!detail || !isFirmUser) return;
    setSavingDocId(documentId);
    setError("");
    try {
      const next = await saveGeneratedDocumentToCaseFiles(detail.id, documentId);
      setDetail(next);
      await loadUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setSavingDocId(null);
    }
  }

  async function handleUploadFile(file: File | null) {
    if (!detail || !file || !canUploadFiles) return;
    if (file.size > maxUploadBytes) {
      setError(t.uploadTooLarge);
      return;
    }
    const allowed = uploadAccept
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!allowed.includes(ext)) {
      setError(t.uploadInvalidType);
      return;
    }
    setUploading(true);
    setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error(t.detailError));
        reader.readAsDataURL(file);
      });
      const created = await uploadCaseDocument(detail.id, {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        data,
      });
      setUploads((prev) => [created, ...prev]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteUpload(uploadId: string) {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      await deleteCaseUpload(detail.id, uploadId);
      setUploads((prev) => prev.filter((item) => item.id !== uploadId));
      if (renamingUploadId === uploadId) {
        setRenamingUploadId(null);
        setRenameDraft("");
      }
      if (filePreview?.uploadId === uploadId) {
        closeFilePreview();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setBusy(false);
    }
  }

  function startRenameUpload(item: CaseUploadedDocumentRecord) {
    setError("");
    setRenamingUploadId(item.id);
    setRenameDraft(item.fileName);
  }

  function cancelRenameUpload() {
    setRenamingUploadId(null);
    setRenameDraft("");
  }

  async function handleRenameUpload(uploadId: string) {
    if (!detail) return;
    const nextName = renameDraft.trim();
    if (!nextName) return;
    setBusy(true);
    setError("");
    try {
      const updated = await renameCaseUpload(detail.id, uploadId, nextName);
      setUploads((prev) =>
        prev.map((item) => (item.id === uploadId ? updated : item))
      );
      setFilePreview((prev) =>
        prev && prev.uploadId === uploadId
          ? { ...prev, title: updated.fileName }
          : prev
      );
      setRenamingUploadId(null);
      setRenameDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setBusy(false);
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function toggleStarredTemplate(templateId: string) {
    if (starLock.current.has(templateId)) return;
    const starred = !starredTemplateIds.includes(templateId);
    const previous = starredTemplateIds;
    starLock.current.add(templateId);
    setStarredTemplateIds(toggleStarredId(previous, templateId));
    if (starred) setTemplatePage(1);
    try {
      const next = await setSkStarredDocumentTemplate(templateId, starred);
      setStarredTemplateIds(next);
    } catch (err) {
      setStarredTemplateIds(previous);
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      starLock.current.delete(templateId);
    }
  }

  const filteredCourtTemplates = useMemo(() => {
    const q = templateSearch.trim();
    const matched = !q
      ? courtTemplates
      : courtTemplates.filter((template) =>
          matchesNepaliRomanSearch(q, [
            template.name.ne,
            template.name.en,
            template.name.roman,
            template.documentKind,
            template.documentKindTitle,
            template.description?.ne,
            template.description?.en,
          ])
        );
    return sortStarredFirst(matched, starredTemplateIds);
  }, [courtTemplates, templateSearch, starredTemplateIds]);

  const templateTotalPages = Math.max(
    1,
    Math.ceil(filteredCourtTemplates.length / TEMPLATE_PAGE_SIZE) || 1
  );
  const activeTemplatePage = Math.min(templatePage, templateTotalPages);
  const pagedCourtTemplates = filteredCourtTemplates.slice(
    (activeTemplatePage - 1) * TEMPLATE_PAGE_SIZE,
    activeTemplatePage * TEMPLATE_PAGE_SIZE
  );
  const courtTypeLabel = detail?.courtType
    ? COURT_TYPE_META[detail.courtType].labelNe
    : "";

  if (loading) {
    return (
      <div className={emiStyles.emiPanel}>
        <p className={pageStyles.calculatorSubtitle}>{t.detailLoading}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={emiStyles.emiPanel}>
        {error && <p className={pageStyles.contactError}>{error}</p>}
        <button type="button" className={pageStyles.skGateDemoBtn} onClick={onBack}>
          {t.backToList}
        </button>
      </div>
    );
  }

  return (
    <div className={shellStyles.panelStack}>
      {quotaDialog ? (
        <FirmQuotaReachedDialog
          kind={quotaDialog.kind}
          used={quotaDialog.used}
          limit={quotaDialog.limit}
          labels={msg.sajilokanun.quotaAlert}
          onClose={() => setQuotaDialog(null)}
        />
      ) : null}
      {pesiToast ? (
        <StatusToast
          message={pesiToast.message}
          tone={pesiToast.tone}
          onDismiss={() => setPesiToast(null)}
        />
      ) : null}
      {error && <p className={pageStyles.contactError}>{error}</p>}

      <div className={emiStyles.emiPanel}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <button
              type="button"
              onClick={onBack}
              className={emiStyles.emiGlossaryLink}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              ← {t.backToList}
            </button>
            <h2 className={emiStyles.emiPanelTitle} style={{ margin: "0.65rem 0 0.25rem" }}>
              {detail.title}
            </h2>
            <p className={emiStyles.emiFieldHint} style={{ margin: 0 }}>
              {t.caseNo} <span className="font-mono font-semibold">{detail.caseNo}</span>
              {" · "}
              {typeLabels[detail.type] ?? detail.type}
              {" · "}
              {statusLabels[detail.status] ?? detail.status}
              {" · "}
              {partyLabels[detail.partySide ?? "plaintiff"]}
              {detail.courtName || detail.courtNameEn ? (
                <>
                  {" · "}
                  {detail.courtName && detail.courtNameEn
                    ? `${detail.courtName} · ${detail.courtNameEn}`
                    : detail.courtName || detail.courtNameEn}
                </>
              ) : null}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              className={pageStyles.skGateDemoBtn}
              onClick={() => onEdit(detail)}
              style={{ margin: 0 }}
            >
              {t.edit}
            </button>
          )}
        </div>

        {detail.notes && (
          <p className={pageStyles.calculatorSubtitle} style={{ marginBottom: "0.5rem" }}>
            <strong>{t.notesLabel}:</strong> {detail.notes}
          </p>
        )}
        {isFirmUser && detail.assignedMemberIds.length > 0 && (
          <p className={emiStyles.emiFieldHint} style={{ marginBottom: 0 }}>
            {t.assigned}: {memberNames(detail.assignedMemberIds)}
          </p>
        )}
      </div>

      <div className={emiStyles.emiPanel}>
        <div className={caseChatStyles.tabs} role="tablist" aria-label="Case sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "messages"}
            className={`${caseChatStyles.tab} ${
              activeTab === "messages" ? caseChatStyles.tabActive : ""
            }`}
            onClick={() => setActiveTab("messages")}
          >
            {t.tabMessages}
            {isFirmUser && unreadFromClient > 0 && (
              <span
                className={caseChatStyles.tabBadge}
                aria-label={t.unreadMessagesBadge.replace(
                  "{n}",
                  String(unreadFromClient)
                )}
              >
                {unreadFromClient > 99 ? "99+" : unreadFromClient}
              </span>
            )}
          </button>
          {isFirmUser && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "users"}
              className={`${caseChatStyles.tab} ${
                activeTab === "users" ? caseChatStyles.tabActive : ""
              }`}
              onClick={() => setActiveTab("users")}
            >
              {t.tabUsers}
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "payments"}
            className={`${caseChatStyles.tab} ${
              activeTab === "payments" ? caseChatStyles.tabActive : ""
            }`}
            onClick={() => setActiveTab("payments")}
          >
            {t.tabPayments}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "activity"}
            className={`${caseChatStyles.tab} ${
              activeTab === "activity" ? caseChatStyles.tabActive : ""
            }`}
            onClick={() => setActiveTab("activity")}
          >
            {t.tabActivity}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "documents"}
            className={`${caseChatStyles.tab} ${
              activeTab === "documents" ? caseChatStyles.tabActive : ""
            }`}
            onClick={() => setActiveTab("documents")}
          >
            {t.tabDocuments}
          </button>
          {isFirmUser && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "generator"}
              className={`${caseChatStyles.tab} ${
                activeTab === "generator" ? caseChatStyles.tabActive : ""
              }`}
              onClick={() => setActiveTab("generator")}
            >
              {t.tabDocumentGenerator}
            </button>
          )}
          {isFirmUser && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "family"}
              className={`${caseChatStyles.tab} ${
                activeTab === "family" ? caseChatStyles.tabActive : ""
              }`}
              onClick={() => setActiveTab("family")}
            >
              {t.tabFamilyTree}
            </button>
          )}
        </div>

        {activeTab === "messages" && (
          <>
            <h3 className={emiStyles.emiPanelTitle}>{t.chatTitle}</h3>
            <p className={emiStyles.emiFieldHint}>{t.chatHint}</p>

            <div className={caseChatStyles.chatWindow} ref={chatWindowRef}>
              {chatLoading ? (
                <p className={pageStyles.calculatorSubtitle}>{t.chatLoading}</p>
              ) : messages.length === 0 ? (
                <p className={pageStyles.calculatorSubtitle}>{t.chatEmpty}</p>
              ) : (
                <>
                  {messages.length > visibleMessageCount ? (
                    <div className={caseChatStyles.chatLoadMore}>
                      <button
                        type="button"
                        className={emiStyles.emiGlossaryLink}
                        onClick={() => {
                          const windowEl = chatWindowRef.current;
                          const previousHeight = windowEl?.scrollHeight ?? 0;
                          stickMessagesToBottomRef.current = false;
                          setVisibleMessageCount((count) =>
                            Math.min(messages.length, count + 10)
                          );
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                              if (!windowEl) return;
                              windowEl.scrollTop = Math.max(
                                0,
                                windowEl.scrollHeight - previousHeight
                              );
                            });
                          });
                        }}
                      >
                        {t.chatLoadMore}
                      </button>
                    </div>
                  ) : null}
                  {messages.slice(-visibleMessageCount).map((message) => {
                    const mine = message.senderAccountId === currentUserId;
                    return (
                      <div
                        key={message.id}
                        className={`${chatStyles.row} ${mine ? chatStyles.rowUser : ""}`}
                      >
                        <div className={chatStyles.column}>
                          <p className={chatStyles.role}>
                            {mine
                              ? t.chatYou
                              : message.senderType === "firm"
                                ? `${t.chatFirm} · ${message.senderName || message.senderUsername}`
                                : `${t.chatClient} · ${message.senderName || message.senderUsername}`}
                            <span className={caseChatStyles.time}>
                              {" · "}
                              {formatTime(message.createdAt)}
                            </span>
                          </p>
                          <div
                            className={`${chatStyles.bubble} ${
                              mine ? chatStyles.bubbleUser : chatStyles.bubbleAssistant
                            }`}
                          >
                            <p className={caseChatStyles.body}>{message.body}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              <div ref={chatEndRef} />
            </div>

            <form
              ref={composerRef}
              onSubmit={handleSendMessage}
              className={caseChatStyles.composer}
            >
              <textarea
                className={emiStyles.emiNumberInput}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.chatPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage(e);
                  }
                }}
              />
              <button
                type="submit"
                className={pageStyles.contactSubmit}
                disabled={sending || !draft.trim()}
              >
                {t.chatSend}
              </button>
            </form>
          </>
        )}

        {activeTab === "users" && isFirmUser && (
          <>
            <div className={caseChatStyles.sectionHeader}>
              <div>
                <h3 className={emiStyles.emiPanelTitle}>{t.caseUsersTitle}</h3>
                <p className={emiStyles.emiFieldHint} style={{ marginBottom: 0 }}>
                  {t.caseUsersHint}
                </p>
              </div>
              {canEdit && !showUserForm && (
                <button
                  type="button"
                  className={pageStyles.contactSubmit}
                  style={{ padding: "0.45rem 1rem", fontSize: "0.875rem", margin: 0 }}
                  onClick={() => setShowUserForm(true)}
                >
                  {t.createUserButton}
                </button>
              )}
            </div>

            {canEdit && showUserForm && (
              <form
                onSubmit={handleCreateUser}
                className={caseChatStyles.formPanel}
              >
                <div className={emiStyles.emiRow}>
                  <div className={emiStyles.emiField}>
                    <label htmlFor="case-user-name">{t.contactNameLabel}</label>
                    <input
                      id="case-user-name"
                      className={emiStyles.emiNumberInput}
                      value={userForm.name}
                      onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t.contactNamePlaceholder}
                      required
                    />
                  </div>
                  <div className={emiStyles.emiField}>
                    <label htmlFor="case-user-phone">{t.contactPhoneLabel}</label>
                    <input
                      id="case-user-phone"
                      className={emiStyles.emiNumberInput}
                      value={userForm.contactNo}
                      onChange={(e) =>
                        setUserForm((f) => ({ ...f, contactNo: e.target.value }))
                      }
                      placeholder={t.contactPhonePlaceholder}
                    />
                  </div>
                </div>
                <div className={emiStyles.emiRow}>
                  <div className={emiStyles.emiField}>
                    <label htmlFor="case-user-username">{t.testimonialContentLabel}</label>
                    <input
                      id="case-user-username"
                      className={emiStyles.emiNumberInput}
                      value={userForm.username}
                      onChange={(e) =>
                        setUserForm((f) => ({ ...f, username: e.target.value }))
                      }
                      placeholder={t.testimonialContentPlaceholder}
                      required
                      autoComplete="off"
                    />
                  </div>
                  <div className={emiStyles.emiField}>
                    <label htmlFor="case-user-password">{t.caseUserPasswordLabel}</label>
                    <input
                      id="case-user-password"
                      type="password"
                      className={emiStyles.emiNumberInput}
                      value={userForm.password}
                      onChange={(e) =>
                        setUserForm((f) => ({ ...f, password: e.target.value }))
                      }
                      placeholder={t.caseUserPasswordPlaceholder}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div className={emiStyles.emiField}>
                  <label htmlFor="case-user-email">{t.caseUserEmailLabel}</label>
                  <input
                    id="case-user-email"
                    type="email"
                    className={emiStyles.emiNumberInput}
                    value={userForm.email}
                    onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder={t.caseUserEmailPlaceholder}
                  />
                </div>
                <div className={caseChatStyles.formActions}>
                  <button
                    type="submit"
                    className={pageStyles.contactSubmit}
                    disabled={busy}
                    style={{ margin: 0 }}
                  >
                    {t.addCaseUser}
                  </button>
                  <button
                    type="button"
                    className={pageStyles.skGateDemoBtn}
                    onClick={() => {
                      setShowUserForm(false);
                      setUserForm({
                        name: "",
                        username: "",
                        password: "",
                        contactNo: "",
                        email: "",
                      });
                    }}
                  >
                    {t.cancelCreateUser}
                  </button>
                </div>
              </form>
            )}

            <div className={shellStyles.panelStack} style={{ gap: "0.65rem" }}>
              {participants.length === 0 && (
                <p className={pageStyles.calculatorSubtitle}>{t.noCaseUsers}</p>
              )}
              {participants.map((user) => (
                <article
                  key={user.id}
                  className={emiStyles.emiFadeCard}
                  style={{ padding: "0.85rem" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <strong style={{ color: "#042c53" }}>{user.name}</strong>
                      <p className={emiStyles.emiFieldHint} style={{ margin: "0.15rem 0 0" }}>
                        @{user.username}
                        {user.contactNo ? ` · ${user.contactNo}` : ""}
                        {user.email ? ` · ${user.email}` : ""}
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        className={emiStyles.emiGlossaryLink}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                        }}
                        onClick={() => void handleRemoveUser(user.id)}
                        disabled={busy}
                      >
                        {t.removeCaseUser}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {activeTab === "documents" && (
          <>
            <div className={caseChatStyles.sectionHeader}>
              <div>
                <h3 className={emiStyles.emiPanelTitle}>{t.documentsTitle}</h3>
                <p className={emiStyles.emiFieldHint} style={{ marginBottom: 0 }}>
                  {t.documentsHint}
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={uploadAccept}
                  hidden
                  onChange={(e) => {
                    void handleUploadFile(e.target.files?.[0] ?? null);
                  }}
                />
                <button
                  type="button"
                  className={pageStyles.contactSubmit}
                  style={{ padding: "0.45rem 1rem", fontSize: "0.875rem", margin: 0 }}
                  disabled={uploading || !canUploadFiles}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? t.uploading : t.uploadButton}
                </button>
              </div>
            </div>

            <div className={shellStyles.panelStack} style={{ gap: "0.65rem" }}>
              {uploads.length === 0 && (
                <p className={pageStyles.calculatorSubtitle}>{t.noUploads}</p>
              )}
              {uploads.map((item) => {
                const canRemove =
                  item.uploadedBy === currentUserId || canManageFiles;
                const isRenaming = renamingUploadId === item.id;
                return (
                  <article
                    key={item.id}
                    className={emiStyles.emiFadeCard}
                    style={{ padding: "0.85rem" }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div style={{ flex: "1 1 12rem", minWidth: 0 }}>
                        {isRenaming ? (
                          <form
                            className="flex flex-wrap items-center gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void handleRenameUpload(item.id);
                            }}
                          >
                            <input
                              type="text"
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              className={pageStyles.contactInput}
                              style={{
                                margin: 0,
                                flex: "1 1 10rem",
                                minWidth: "8rem",
                                maxWidth: "24rem",
                              }}
                              autoFocus
                              disabled={busy}
                              aria-label={t.renameUpload}
                            />
                            <button
                              type="submit"
                              className={emiStyles.emiGlossaryLink}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
                              disabled={busy || !renameDraft.trim()}
                            >
                              {busy ? t.renamingUpload : t.saveRenameUpload}
                            </button>
                            <button
                              type="button"
                              className={emiStyles.emiGlossaryLink}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
                              onClick={cancelRenameUpload}
                              disabled={busy}
                            >
                              {t.cancelRenameUpload}
                            </button>
                          </form>
                        ) : (
                          <>
                            <strong style={{ color: "#042c53" }}>{item.fileName}</strong>
                            <p
                              className={emiStyles.emiFieldHint}
                              style={{ margin: "0.15rem 0 0" }}
                            >
                              {formatFileSize(item.size)}
                              {" · "}
                              {item.uploaderName ||
                                item.uploaderUsername ||
                                item.uploadedBy}
                              {" · "}
                              {formatDate(item.createdAt)}
                            </p>
                          </>
                        )}
                      </div>
                      {!isRenaming && (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className={emiStyles.emiGlossaryLink}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                            disabled={previewingUploadId === item.id}
                            onClick={() => void handlePreviewUpload(item)}
                          >
                            {previewingUploadId === item.id
                              ? t.previewingUpload
                              : t.previewUpload}
                          </button>
                          <button
                            type="button"
                            className={emiStyles.emiGlossaryLink}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                            onClick={() =>
                              void downloadCaseUpload(
                                detail.id,
                                item.id,
                                item.fileName
                              )
                            }
                          >
                            {t.downloadUpload}
                          </button>
                          {canRemove && (
                            <>
                              <button
                                type="button"
                                className={emiStyles.emiGlossaryLink}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                                onClick={() => startRenameUpload(item)}
                                disabled={busy}
                              >
                                {t.renameUpload}
                              </button>
                              <button
                                type="button"
                                className={emiStyles.emiGlossaryLink}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                                onClick={() => void handleDeleteUpload(item.id)}
                                disabled={busy}
                              >
                                {t.removeUpload}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {activeTab === "activity" && (
          <>
            <div className={caseChatStyles.sectionHeader}>
              <div>
                <h3 className={emiStyles.emiPanelTitle}>{t.activityTitle}</h3>
                <p className={emiStyles.emiFieldHint} style={{ marginBottom: 0 }}>
                  {t.activityHint}
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <button
                  type="button"
                  className={pageStyles.skGateDemoBtn}
                  style={{ padding: "0.45rem 1rem", fontSize: "0.875rem", margin: 0 }}
                  onClick={() => void handleFetchPesi()}
                  disabled={fetchingPesi || busy}
                  title={t.fetchPesiHint}
                >
                  {fetchingPesi ? t.fetchPesiBusy : t.fetchPesi}
                </button>
                {!showActivityForm && (
                  <button
                    type="button"
                    className={pageStyles.contactSubmit}
                    style={{ padding: "0.45rem 1rem", fontSize: "0.875rem", margin: 0 }}
                    onClick={() => {
                      setActivityForm((f) => ({
                        ...f,
                        bsDate: getTodayBs(),
                      }));
                      setShowActivityForm(true);
                    }}
                  >
                    {t.addActivity}
                  </button>
                )}
              </div>
            </div>

            <p className={emiStyles.emiFieldHint}>{t.fetchPesiHint}</p>

            <div style={{ marginBottom: "1.25rem" }}>
              <h4 className={emiStyles.emiPanelTitle} style={{ fontSize: "1rem" }}>
                {t.pesiTableTitle}
              </h4>
              {pesiRows.length === 0 ? (
                <p className={pageStyles.calculatorSubtitle}>{t.noPesiRows}</p>
              ) : (
                <div className={caseChatStyles.activityTableWrap}>
                  <table className={caseChatStyles.activityTable}>
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                        <th className="pb-2 pr-3 font-medium">{t.pesiColDate}</th>
                        {(pesiColumns.length
                          ? pesiColumns
                          : [
                              { key: "sn", labelNe: "क्र स", labelEn: "S.N." },
                              { key: "caseNoRaw", labelNe: "मुद्दा नं", labelEn: "Case no." },
                              {
                                key: "registrationDate",
                                labelNe: "दर्ता मिती",
                                labelEn: "Registration",
                              },
                              { key: "matter", labelNe: "मुद्दा", labelEn: "Matter" },
                              {
                                key: "parties",
                                labelNe: "पक्ष || विपक्ष",
                                labelEn: "Parties",
                              },
                              { key: "fantawala", labelNe: "फाँटवाला", labelEn: "Section" },
                              { key: "signal", labelNe: "संकेत", labelEn: "Signal" },
                              {
                                key: "priority",
                                labelNe: "प्राथमिकता",
                                labelEn: "Priority",
                              },
                              { key: "remarks", labelNe: "कैफियत", labelEn: "Remarks" },
                            ]
                        ).map((col) => (
                          <th key={col.key} className="pb-2 pr-3 font-medium">
                            {locale === "ne" ? col.labelNe : col.labelEn}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pesiRows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-[var(--border)] align-top"
                        >
                          <td className="py-2.5 pr-3 whitespace-nowrap">{row.pesiDate}</td>
                          <td className="py-2.5 pr-3">{row.sn}</td>
                          <td className="py-2.5 pr-3 whitespace-pre-line font-mono text-xs">
                            {row.caseNoRaw}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            {row.registrationDate}
                          </td>
                          <td className="py-2.5 pr-3">{row.matter}</td>
                          <td className="py-2.5 pr-3">{row.parties}</td>
                          <td className="py-2.5 pr-3">{row.fantawala}</td>
                          <td className="py-2.5 pr-3">{row.signal}</td>
                          <td className="py-2.5 pr-3">{row.priority}</td>
                          <td className="py-2.5 pr-3">{row.remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {showActivityForm && (
              <form
                onSubmit={handleAddActivity}
                className={caseChatStyles.formPanel}
              >
                <div className={emiStyles.emiField}>
                  <SheetSelect
                    label={t.activityTypeLabel}
                    value={activityForm.activityType}
                    options={CASE_ACTIVITY_TYPES.map((type) => ({
                      value: type,
                      label: t[ACTIVITY_LABEL_KEYS[type]],
                    }))}
                    onChange={(next) =>
                      setActivityForm((f) => ({
                        ...f,
                        activityType: next as CaseActivityType,
                      }))
                    }
                  />
                </div>

                <div className={emiStyles.emiField}>
                  <label>{t.activityDateLabel}</label>
                  <NepaliDatePicker
                    value={activityForm.bsDate}
                    onChange={(bsDate) =>
                      setActivityForm((f) => ({ ...f, bsDate }))
                    }
                    locale={locale}
                    yearLabel={t.bsYear}
                    monthLabel={t.bsMonth}
                    dayLabel={t.bsDay}
                  />
                  <p className={emiStyles.emiFieldHint} style={{ marginTop: "0.35rem" }}>
                    {formatBsDate(activityForm.bsDate, locale)}
                  </p>
                </div>

                <div className={emiStyles.emiField}>
                  <label htmlFor="activity-note">{t.activityNoteLabel}</label>
                  <input
                    id="activity-note"
                    className={emiStyles.emiNumberInput}
                    value={activityForm.note}
                    onChange={(e) =>
                      setActivityForm((f) => ({ ...f, note: e.target.value }))
                    }
                    placeholder={t.activityNotePlaceholder}
                  />
                </div>

                <div className={caseChatStyles.formActions}>
                  <button
                    type="submit"
                    className={pageStyles.contactSubmit}
                    disabled={busy}
                    style={{ margin: 0 }}
                  >
                    {t.addActivity}
                  </button>
                  <button
                    type="button"
                    className={emiStyles.emiGlossaryLink}
                    style={{
                      background: "none",
                      border: "1px solid var(--border, #d7e3f4)",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      padding: "0.55rem 0.75rem",
                    }}
                    onClick={() => setShowActivityForm(false)}
                    disabled={busy}
                  >
                    {t.cancelAddActivity}
                  </button>
                </div>
              </form>
            )}

            {activities.length === 0 ? (
              <p className={pageStyles.calculatorSubtitle}>{t.noActivities}</p>
            ) : (
              <>
                <div className={caseChatStyles.activityTableWrap}>
                  <table className={caseChatStyles.activityTable}>
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                        <th className="pb-2 pr-3 font-medium">{t.activityColType}</th>
                        <th className="pb-2 pr-3 font-medium">{t.activityColDate}</th>
                        <th className="pb-2 pr-3 font-medium">{t.activityColRemaining}</th>
                        <th className="pb-2 pr-3 font-medium">{t.activityColNote}</th>
                        <th className="pb-2 pr-3 font-medium">{t.activityColAddedBy}</th>
                        <th className="pb-2 font-medium">{t.activityColActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((item) => {
                        const canDelete =
                          isFirmUser || item.createdBy === currentUserId;
                        const bsDate = {
                          year: item.bsYear,
                          month: item.bsMonth,
                          day: item.bsDay,
                        };
                        const remaining = remainingDaysFromBs(bsDate);
                        const remainingLabel = formatRemainingDays(remaining, t, locale);
                        return (
                          <tr
                            key={item.id}
                            className="border-b border-[var(--border)] align-top"
                          >
                            <td className="py-2.5 pr-3">
                              <div className="font-medium text-[var(--foreground)]">
                                {item.labelNe}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                {item.labelEn}
                              </div>
                            </td>
                            <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">
                              {formatBsDate(bsDate, locale)}
                            </td>
                            <td
                              className="py-2.5 pr-3 whitespace-nowrap font-medium"
                              style={{
                                color:
                                  remaining < 0
                                    ? "#b42318"
                                    : remaining === 0
                                      ? "#b54708"
                                      : "#027a48",
                              }}
                            >
                              {remainingLabel}
                            </td>
                            <td className="py-2.5 pr-3 text-[var(--muted)]">
                              {item.note || "—"}
                            </td>
                            <td className="py-2.5 pr-3 text-[var(--muted)]">
                              {item.createdByName || item.createdByUsername || "—"}
                            </td>
                            <td className="py-2.5">
                              {canDelete ? (
                                <button
                                  type="button"
                                  className={emiStyles.emiGlossaryLink}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                  onClick={() => void handleDeleteActivity(item.id)}
                                  disabled={busy}
                                >
                                  {t.deleteItem}
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className={caseChatStyles.activityCards}>
                  {activities.map((item) => {
                    const canDelete =
                      isFirmUser || item.createdBy === currentUserId;
                    const bsDate = {
                      year: item.bsYear,
                      month: item.bsMonth,
                      day: item.bsDay,
                    };
                    const remaining = remainingDaysFromBs(bsDate);
                    const remainingLabel = formatRemainingDays(remaining, t, locale);
                    return (
                      <article key={item.id} className={caseChatStyles.activityCard}>
                        <strong style={{ color: "#042c53", display: "block" }}>
                          {item.labelNe}
                        </strong>
                        <p className={caseChatStyles.activityCardLabel}>{item.labelEn}</p>
                        <div className={caseChatStyles.activityCardRow}>
                          <div>
                            <p className={caseChatStyles.activityCardLabel}>
                              {t.activityColDate}
                            </p>
                            <p className={caseChatStyles.activityCardValue}>
                              {formatBsDate(bsDate, locale)}
                            </p>
                          </div>
                          <div>
                            <p className={caseChatStyles.activityCardLabel}>
                              {t.activityColRemaining}
                            </p>
                            <p
                              className={caseChatStyles.activityCardValue}
                              style={{
                                fontWeight: 600,
                                color:
                                  remaining < 0
                                    ? "#b42318"
                                    : remaining === 0
                                      ? "#b54708"
                                      : "#027a48",
                              }}
                            >
                              {remainingLabel}
                            </p>
                          </div>
                        </div>
                        <div className={caseChatStyles.activityCardRow}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p className={caseChatStyles.activityCardLabel}>
                              {t.activityColNote}
                            </p>
                            <p className={caseChatStyles.activityCardValue}>
                              {item.note || "—"}
                            </p>
                          </div>
                        </div>
                        <div className={caseChatStyles.activityCardRow}>
                          <div>
                            <p className={caseChatStyles.activityCardLabel}>
                              {t.activityColAddedBy}
                            </p>
                            <p className={caseChatStyles.activityCardValue}>
                              {item.createdByName || item.createdByUsername || "—"}
                            </p>
                          </div>
                          {canDelete && (
                            <button
                              type="button"
                              className={emiStyles.emiGlossaryLink}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                alignSelf: "flex-end",
                              }}
                              onClick={() => void handleDeleteActivity(item.id)}
                              disabled={busy}
                            >
                              {t.deleteItem}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "payments" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className={emiStyles.emiPanelTitle} style={{ margin: 0 }}>
                {t.paymentsTitle}
              </h3>
              <span className={emiStyles.emiFieldHint} style={{ margin: 0 }}>
                {t.totalPaid}:{" "}
                <strong>
                  {formatMoney(totalPaid, detail.payments?.[0]?.currency || "NPR")}
                </strong>
              </span>
            </div>
            <p className={emiStyles.emiFieldHint}>
              {isFirmUser ? t.paymentsHint : t.paymentsHintClient}
            </p>

            {isFirmUser && (
            <form
              onSubmit={handleAddPayment}
              className={caseChatStyles.formPanel}
            >
              <div className={emiStyles.emiRow}>
                <div className={emiStyles.emiField}>
                  <label htmlFor="payment-amount">{t.amountLabel}</label>
                  <input
                    id="payment-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    className={emiStyles.emiNumberInput}
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className={emiStyles.emiField}>
                  <label htmlFor="payment-currency">{t.currencyLabel}</label>
                  <input
                    id="payment-currency"
                    className={emiStyles.emiNumberInput}
                    value={paymentForm.currency}
                    onChange={(e) =>
                      setPaymentForm((f) => ({ ...f, currency: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className={emiStyles.emiRow}>
                <div className={emiStyles.emiField}>
                  <label htmlFor="payment-method">{t.methodLabel}</label>
                  <input
                    id="payment-method"
                    className={emiStyles.emiNumberInput}
                    value={paymentForm.method}
                    onChange={(e) =>
                      setPaymentForm((f) => ({ ...f, method: e.target.value }))
                    }
                    placeholder={t.methodPlaceholder}
                  />
                </div>
                <div className={emiStyles.emiField}>
                  <label htmlFor="payment-date">{t.paidAtLabel}</label>
                  <input
                    id="payment-date"
                    type="date"
                    className={emiStyles.emiNumberInput}
                    value={paymentForm.paidAt}
                    onChange={(e) =>
                      setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div className={emiStyles.emiField}>
                <label htmlFor="payment-note">{t.paymentNoteLabel}</label>
                <input
                  id="payment-note"
                  className={emiStyles.emiNumberInput}
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder={t.paymentNotePlaceholder}
                />
              </div>
              <div className={caseChatStyles.formActions}>
                <button
                  type="submit"
                  className={pageStyles.contactSubmit}
                  disabled={busy}
                  style={{ margin: 0 }}
                >
                  {t.addPayment}
                </button>
              </div>
            </form>
            )}

            <div className={shellStyles.panelStack} style={{ gap: "0.65rem", marginTop: "1rem" }}>
              {(detail.payments?.length ?? 0) === 0 && (
                <p className={pageStyles.calculatorSubtitle}>{t.noPayments}</p>
              )}
              {(detail.payments ?? [])
                .slice()
                .sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt))
                .map((item) => (
                  <article
                    key={item.id}
                    className={emiStyles.emiFadeCard}
                    style={{ padding: "0.85rem" }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <strong style={{ color: "#042c53" }}>
                          {formatMoney(item.amount, item.currency)}
                        </strong>
                        <p className={emiStyles.emiFieldHint} style={{ margin: "0.15rem 0 0" }}>
                          {formatDate(item.paidAt)}
                          {item.method ? ` · ${item.method}` : ""}
                        </p>
                      </div>
                      {isFirmUser && (
                        <button
                          type="button"
                          className={emiStyles.emiGlossaryLink}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                          }}
                          onClick={() => void handleDeletePayment(item.id)}
                          disabled={busy}
                        >
                          {t.deleteItem}
                        </button>
                      )}
                    </div>
                    {item.note && (
                      <p
                        className={pageStyles.calculatorSubtitle}
                        style={{ margin: "0.5rem 0 0" }}
                      >
                        {item.note}
                      </p>
                    )}
                  </article>
                ))}
            </div>
          </>
        )}

        {isFirmUser && activeTab === "family" && (
          <CaseFamilyTree
            tree={extractEditForm.वंशावली}
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
        )}

        {isFirmUser && activeTab === "generator" && (
          <>
            <section style={{ marginBottom: "1.75rem" }}>
              <h3 className={emiStyles.emiPanelTitle}>{t.documentExtractorTitle}</h3>
              <p className={emiStyles.emiFieldHint}>{t.documentExtractorHint}</p>

              <p className={emiStyles.emiFieldHint} style={{ marginBottom: "0.4rem" }}>
                {t.extractorPickUploads}
              </p>
              {uploads.length === 0 ? (
                <p className={pageStyles.calculatorSubtitle}>{t.noUploads}</p>
              ) : (
                <div className={shellStyles.panelStack} style={{ gap: "0.4rem", marginBottom: "0.85rem" }}>
                  {uploads.map((item) => {
                    const checked = extractSelectedUploadIds.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={emiStyles.emiFadeCard}
                        style={{
                          padding: "0.65rem 0.85rem",
                          display: "flex",
                          gap: "0.65rem",
                          alignItems: "flex-start",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setExtractSelectedUploadIds((ids) =>
                              checked
                                ? ids.filter((id) => id !== item.id)
                                : [...ids, item.id]
                            )
                          }
                          style={{ marginTop: "0.2rem" }}
                        />
                        <span>
                          <strong style={{ color: "#042c53" }}>{item.fileName}</strong>
                          <span
                            className={emiStyles.emiFieldHint}
                            style={{ display: "block", margin: "0.1rem 0 0" }}
                          >
                            {formatFileSize(item.size)} · {formatDate(item.createdAt)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div style={{ marginBottom: "0.85rem" }}>
                <input
                  ref={extractFileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.gif,image/*,application/pdf"
                  multiple
                  hidden
                  onChange={(e) => {
                    const next = Array.from(e.target.files ?? []);
                    setExtractLocalFiles((current) => [...current, ...next].slice(0, 8));
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className={emiStyles.emiPreset}
                  onClick={() => extractFileInputRef.current?.click()}
                  disabled={extracting}
                >
                  {t.extractorAddFiles}
                </button>
                {extractLocalFiles.length > 0 ? (
                  <ul
                    style={{
                      margin: "0.65rem 0 0",
                      paddingLeft: "1.1rem",
                      fontSize: "0.875rem",
                      color: "#374151",
                    }}
                  >
                    {extractLocalFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        {file.name}{" "}
                        <button
                          type="button"
                          className={emiStyles.emiGlossaryLink}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                          }}
                          onClick={() =>
                            setExtractLocalFiles((files) =>
                              files.filter((_, i) => i !== index)
                            )
                          }
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className={caseChatStyles.formActions}>
                <button
                  type="button"
                  className={pageStyles.contactSubmit}
                  style={{ margin: 0 }}
                  disabled={extracting || extractSaving}
                  onClick={() => void handleExtractDocuments()}
                >
                  {extracting ? t.extractorExtracting : t.extractorGenerate}
                </button>
                {extractHasDraft ? (
                  <button
                    type="button"
                    className={pageStyles.contactSubmit}
                    style={{ margin: 0 }}
                    disabled={extractSaving || (!extractDirty && extractIsSaved)}
                    onClick={() => void handleSaveExtraction()}
                  >
                    {extractSaving
                      ? t.extractorSaving
                      : extractIsSaved && !extractDirty
                        ? t.extractorSaved
                        : t.extractorSave}
                  </button>
                ) : null}
                {extractHasDraft && !extractIsSaved ? (
                  <button
                    type="button"
                    className={emiStyles.emiGlossaryLink}
                    style={{
                      background: "none",
                      border: "1px solid var(--border, #d7e3f4)",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      padding: "0.55rem 0.75rem",
                    }}
                    onClick={() => {
                      setExtractEditForm(emptyExtractedCaseDocument());
                      setExtractHasDraft(false);
                      setExtractDirty(false);
                      setExtractMeta(null);
                      setExtractCopied(false);
                    }}
                  >
                    {t.extractorClear}
                  </button>
                ) : null}
              </div>

              {extractHasDraft ? (
                <article
                  className={emiStyles.emiFadeCard}
                  style={{ padding: "0.85rem", marginTop: "1rem" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong style={{ color: "#042c53" }}>
                      {extractIsSaved ? t.extractorSavedTitle : t.extractorUnsavedTitle}
                    </strong>
                    <button
                      type="button"
                      className={emiStyles.emiGlossaryLink}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(JSON.stringify(extractEditForm, null, 2))
                          .then(() => {
                            setExtractCopied(true);
                            window.setTimeout(() => setExtractCopied(false), 2000);
                          });
                      }}
                    >
                      {extractCopied ? t.extractorCopied : t.extractorCopyJson}
                    </button>
                  </div>
                  <p className={emiStyles.emiFieldHint}>{t.extractorEditHint}</p>
                  {extractMeta?.updatedAt ? (
                    <p className={emiStyles.emiFieldHint} style={{ marginTop: 0 }}>
                      {t.extractorLastSaved}: {formatTime(extractMeta.updatedAt)}
                      {extractMeta.fileNames.length
                        ? ` · ${extractMeta.fileNames.join(", ")}`
                        : ""}
                    </p>
                  ) : extractMeta?.fileNames?.length ? (
                    <p className={emiStyles.emiFieldHint} style={{ marginTop: 0 }}>
                      {extractMeta.fileNames.join(", ")}
                    </p>
                  ) : null}

                  <div className={emiStyles.emiRow}>
                    <div className={emiStyles.emiField}>
                      <label htmlFor="ex-court">अदालतको नाम</label>
                      <input
                        id="ex-court"
                        className={emiStyles.emiNumberInput}
                        value={extractEditForm.अदालत_विवरण.अदालतको_नाम ?? ""}
                        onChange={(e) =>
                          patchExtraction((f) => ({
                            ...f,
                            अदालत_विवरण: {
                              ...f.अदालत_विवरण,
                              अदालतको_नाम: e.target.value || null,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className={emiStyles.emiField}>
                      <label htmlFor="ex-case-no">मुद्दा नं.</label>
                      <input
                        id="ex-case-no"
                        className={emiStyles.emiNumberInput}
                        value={extractEditForm.अदालत_विवरण.मुद्दा_नं ?? ""}
                        onChange={(e) =>
                          patchExtraction((f) => ({
                            ...f,
                            अदालत_विवरण: {
                              ...f.अदालत_विवरण,
                              मुद्दा_नं: e.target.value || null,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className={emiStyles.emiRow}>
                    <div className={emiStyles.emiField}>
                      <label htmlFor="ex-reg-date">दर्ता मिति (वि.सं.)</label>
                      <input
                        id="ex-reg-date"
                        className={emiStyles.emiNumberInput}
                        value={extractEditForm.अदालत_विवरण.दर्ता_मिति_वि_सं ?? ""}
                        onChange={(e) =>
                          patchExtraction((f) => ({
                            ...f,
                            अदालत_विवरण: {
                              ...f.अदालत_विवरण,
                              दर्ता_मिति_वि_सं: e.target.value || null,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className={emiStyles.emiField}>
                      <label htmlFor="ex-subject">मुद्दाको विषय</label>
                      <input
                        id="ex-subject"
                        className={emiStyles.emiNumberInput}
                        value={extractEditForm.अदालत_विवरण.मुद्दाको_विषय ?? ""}
                        onChange={(e) =>
                          patchExtraction((f) => ({
                            ...f,
                            अदालत_विवरण: {
                              ...f.अदालत_विवरण,
                              मुद्दाको_विषय: e.target.value || null,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: "0.85rem" }}>
                    <div
                      className="flex flex-wrap items-center justify-between gap-2"
                      style={{ marginBottom: "0.5rem" }}
                    >
                      <strong style={{ color: "#042c53", fontSize: "0.9rem" }}>
                        {t.extractorPlaintiffsTitle}
                      </strong>
                      <button
                        type="button"
                        className={emiStyles.emiPreset}
                        onClick={() =>
                          patchExtraction((f) => {
                            const next = [...f.वादी_विवरण, emptyExtractedParty()];
                            return {
                              ...f,
                              वादी_विवरण: next,
                              निवेदक_विवरण: next.map((p) => ({ ...p })),
                            };
                          })
                        }
                      >
                        {t.extractorAddPlaintiff}
                      </button>
                    </div>
                    {extractEditForm.वादी_विवरण.map((plaintiff, index) => (
                      <div
                        key={`plaintiff-${index}`}
                        style={{
                          border: "1px solid var(--border, #d7e3f4)",
                          borderRadius: "0.5rem",
                          padding: "0.75rem",
                          marginBottom: "0.65rem",
                        }}
                      >
                        <div
                          className="flex flex-wrap items-center justify-between gap-2"
                          style={{ marginBottom: "0.5rem" }}
                        >
                          <span className={emiStyles.emiFieldHint} style={{ margin: 0 }}>
                            {t.extractorPlaintiffN.replace("{n}", String(index + 1))}
                          </span>
                          {extractEditForm.वादी_विवरण.length > 1 ? (
                            <button
                              type="button"
                              className={emiStyles.emiGlossaryLink}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
                              onClick={() =>
                                patchExtraction((f) => {
                                  const next = f.वादी_विवरण.filter((_, i) => i !== index);
                                  return {
                                    ...f,
                                    वादी_विवरण: next,
                                    निवेदक_विवरण: next.map((p) => ({ ...p })),
                                  };
                                })
                              }
                            >
                              {t.extractorRemovePlaintiff}
                            </button>
                          ) : null}
                        </div>
                        <div className={emiStyles.emiRow}>
                          <div className={emiStyles.emiField}>
                            <label htmlFor={`ex-pl-name-${index}`}>पूरा नाम</label>
                            <input
                              id={`ex-pl-name-${index}`}
                              className={emiStyles.emiNumberInput}
                              value={plaintiff.पूरा_नाम ?? ""}
                              onChange={(e) =>
                                patchExtraction((f) => {
                                  const next = [...f.वादी_विवरण];
                                  next[index] = {
                                    ...next[index],
                                    पूरा_नाम: e.target.value || null,
                                  };
                                  return {
                                    ...f,
                                    वादी_विवरण: next,
                                    निवेदक_विवरण: next.map((p) => ({ ...p })),
                                  };
                                })
                              }
                            />
                          </div>
                          <div className={emiStyles.emiField}>
                            <label htmlFor={`ex-pl-teen-${index}`}>तीनपुस्ते</label>
                            <input
                              id={`ex-pl-teen-${index}`}
                              className={emiStyles.emiNumberInput}
                              value={plaintiff.तीनपुस्ते ?? ""}
                              onChange={(e) =>
                                patchExtraction((f) => {
                                  const next = [...f.वादी_विवरण];
                                  next[index] = {
                                    ...next[index],
                                    तीनपुस्ते: e.target.value || null,
                                  };
                                  return {
                                    ...f,
                                    वादी_विवरण: next,
                                    निवेदक_विवरण: next.map((p) => ({ ...p })),
                                  };
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className={emiStyles.emiRow}>
                          <div className={emiStyles.emiField}>
                            <label htmlFor={`ex-pl-addr-${index}`}>ठेगाना</label>
                            <input
                              id={`ex-pl-addr-${index}`}
                              className={emiStyles.emiNumberInput}
                              value={plaintiff.ठेगाना ?? ""}
                              onChange={(e) =>
                                patchExtraction((f) => {
                                  const next = [...f.वादी_विवरण];
                                  next[index] = {
                                    ...next[index],
                                    ठेगाना: e.target.value || null,
                                  };
                                  return {
                                    ...f,
                                    वादी_विवरण: next,
                                    निवेदक_विवरण: next.map((p) => ({ ...p })),
                                  };
                                })
                              }
                            />
                          </div>
                          <div className={emiStyles.emiField}>
                            <label htmlFor={`ex-pl-cit-${index}`}>नागरिकता नं.</label>
                            <input
                              id={`ex-pl-cit-${index}`}
                              className={emiStyles.emiNumberInput}
                              value={plaintiff.नागरिकता_नं ?? ""}
                              onChange={(e) =>
                                patchExtraction((f) => {
                                  const next = [...f.वादी_विवरण];
                                  next[index] = {
                                    ...next[index],
                                    नागरिकता_नं: e.target.value || null,
                                  };
                                  return {
                                    ...f,
                                    वादी_विवरण: next,
                                    निवेदक_विवरण: next.map((p) => ({ ...p })),
                                  };
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "0.85rem" }}>
                    <div
                      className="flex flex-wrap items-center justify-between gap-2"
                      style={{ marginBottom: "0.5rem" }}
                    >
                      <strong style={{ color: "#042c53", fontSize: "0.9rem" }}>
                        {t.extractorDefendantsTitle}
                      </strong>
                      <button
                        type="button"
                        className={emiStyles.emiPreset}
                        onClick={() =>
                          patchExtraction((f) => {
                            const next = [...f.प्रतिवादी_विवरण, emptyExtractedParty()];
                            return {
                              ...f,
                              प्रतिवादी_विवरण: next,
                              विपक्षी_विवरण: next.map((p) => ({ ...p })),
                            };
                          })
                        }
                      >
                        {t.extractorAddDefendant}
                      </button>
                    </div>
                    {extractEditForm.प्रतिवादी_विवरण.map((defendant, index) => (
                      <div
                        key={`defendant-${index}`}
                        style={{
                          border: "1px solid var(--border, #d7e3f4)",
                          borderRadius: "0.5rem",
                          padding: "0.75rem",
                          marginBottom: "0.65rem",
                        }}
                      >
                        <div
                          className="flex flex-wrap items-center justify-between gap-2"
                          style={{ marginBottom: "0.5rem" }}
                        >
                          <span className={emiStyles.emiFieldHint} style={{ margin: 0 }}>
                            {t.extractorDefendantN.replace("{n}", String(index + 1))}
                          </span>
                          {extractEditForm.प्रतिवादी_विवरण.length > 1 ? (
                            <button
                              type="button"
                              className={emiStyles.emiGlossaryLink}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
                              onClick={() =>
                                patchExtraction((f) => {
                                  const next = f.प्रतिवादी_विवरण.filter(
                                    (_, i) => i !== index
                                  );
                                  return {
                                    ...f,
                                    प्रतिवादी_विवरण: next,
                                    विपक्षी_विवरण: next.map((p) => ({ ...p })),
                                  };
                                })
                              }
                            >
                              {t.extractorRemoveDefendant}
                            </button>
                          ) : null}
                        </div>
                        <div className={emiStyles.emiRow}>
                          <div className={emiStyles.emiField}>
                            <label htmlFor={`ex-def-name-${index}`}>पूरा नाम</label>
                            <input
                              id={`ex-def-name-${index}`}
                              className={emiStyles.emiNumberInput}
                              value={defendant.पूरा_नाम ?? ""}
                              onChange={(e) =>
                                patchExtraction((f) => {
                                  const next = [...f.प्रतिवादी_विवरण];
                                  next[index] = {
                                    ...next[index],
                                    पूरा_नाम: e.target.value || null,
                                  };
                                  return {
                                    ...f,
                                    प्रतिवादी_विवरण: next,
                                    विपक्षी_विवरण: next.map((p) => ({ ...p })),
                                  };
                                })
                              }
                            />
                          </div>
                          <div className={emiStyles.emiField}>
                            <label htmlFor={`ex-def-teen-${index}`}>तीनपुस्ते</label>
                            <input
                              id={`ex-def-teen-${index}`}
                              className={emiStyles.emiNumberInput}
                              value={defendant.तीनपुस्ते ?? ""}
                              onChange={(e) =>
                                patchExtraction((f) => {
                                  const next = [...f.प्रतिवादी_विवरण];
                                  next[index] = {
                                    ...next[index],
                                    तीनपुस्ते: e.target.value || null,
                                  };
                                  return {
                                    ...f,
                                    प्रतिवादी_विवरण: next,
                                    विपक्षी_विवरण: next.map((p) => ({ ...p })),
                                  };
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className={emiStyles.emiRow}>
                          <div className={emiStyles.emiField}>
                            <label htmlFor={`ex-def-addr-${index}`}>ठेगाना</label>
                            <input
                              id={`ex-def-addr-${index}`}
                              className={emiStyles.emiNumberInput}
                              value={defendant.ठेगाना ?? ""}
                              onChange={(e) =>
                                patchExtraction((f) => {
                                  const next = [...f.प्रतिवादी_विवरण];
                                  next[index] = {
                                    ...next[index],
                                    ठेगाना: e.target.value || null,
                                  };
                                  return {
                                    ...f,
                                    प्रतिवादी_विवरण: next,
                                    विपक्षी_विवरण: next.map((p) => ({ ...p })),
                                  };
                                })
                              }
                            />
                          </div>
                          <div className={emiStyles.emiField}>
                            <label htmlFor={`ex-def-cit-${index}`}>नागरिकता नं.</label>
                            <input
                              id={`ex-def-cit-${index}`}
                              className={emiStyles.emiNumberInput}
                              value={defendant.नागरिकता_नं ?? ""}
                              onChange={(e) =>
                                patchExtraction((f) => {
                                  const next = [...f.प्रतिवादी_विवरण];
                                  next[index] = {
                                    ...next[index],
                                    नागरिकता_नं: e.target.value || null,
                                  };
                                  return {
                                    ...f,
                                    प्रतिवादी_विवरण: next,
                                    विपक्षी_विवरण: next.map((p) => ({ ...p })),
                                  };
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={emiStyles.emiRow} style={{ marginTop: "0.85rem" }}>
                    <div className={emiStyles.emiField}>
                      <label htmlFor="ex-bigo">बिगो रकम (रु.)</label>
                      <input
                        id="ex-bigo"
                        type="number"
                        className={emiStyles.emiNumberInput}
                        value={extractEditForm.आर्थिक_तथा_तथ्य.बिगो_रकम_रु ?? ""}
                        onChange={(e) =>
                          patchExtraction((f) => ({
                            ...f,
                            आर्थिक_तथा_तथ्य: {
                              ...f.आर्थिक_तथा_तथ्य,
                              बिगो_रकम_रु:
                                e.target.value.trim() === ""
                                  ? null
                                  : Number(e.target.value),
                            },
                          }))
                        }
                      />
                    </div>
                    <div className={emiStyles.emiField}>
                      <label htmlFor="ex-incident">घटना मिति (वि.सं.)</label>
                      <input
                        id="ex-incident"
                        className={emiStyles.emiNumberInput}
                        value={extractEditForm.आर्थिक_तथा_तथ्य.घटना_मिति_वि_सं ?? ""}
                        onChange={(e) =>
                          patchExtraction((f) => ({
                            ...f,
                            आर्थिक_तथा_तथ्य: {
                              ...f.आर्थिक_तथा_तथ्य,
                              घटना_मिति_वि_सं: e.target.value || null,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className={emiStyles.emiField}>
                    <label htmlFor="ex-facts">तथ्य सारांश</label>
                    <textarea
                      id="ex-facts"
                      className={emiStyles.emiNumberInput}
                      rows={3}
                      value={extractEditForm.आर्थिक_तथा_तथ्य.तथ्य_सारांश ?? ""}
                      onChange={(e) =>
                        patchExtraction((f) => ({
                          ...f,
                          आर्थिक_तथा_तथ्य: {
                            ...f.आर्थिक_तथा_तथ्य,
                            तथ्य_सारांश: e.target.value || null,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className={emiStyles.emiField}>
                    <label htmlFor="ex-sections">उद्धृत दफाहरू (एक पङ्क्तिमा एक)</label>
                    <textarea
                      id="ex-sections"
                      className={emiStyles.emiNumberInput}
                      rows={3}
                      value={extractEditForm.कानूनी_आधार.उद्धृत_दफाहरू.join("\n")}
                      onChange={(e) =>
                        patchExtraction((f) => ({
                          ...f,
                          कानूनी_आधार: {
                            ...f.कानूनी_आधार,
                            उद्धृत_दफाहरू: e.target.value
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className={emiStyles.emiField}>
                    <label htmlFor="ex-limitation">हदम्याद स्थिति</label>
                    <input
                      id="ex-limitation"
                      className={emiStyles.emiNumberInput}
                      value={extractEditForm.कानूनी_आधार.हदम्याद_स्थिति ?? ""}
                      onChange={(e) =>
                        patchExtraction((f) => ({
                          ...f,
                          कानूनी_आधार: {
                            ...f.कानूनी_आधार,
                            हदम्याद_स्थिति: e.target.value || null,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className={emiStyles.emiField}>
                    <label htmlFor="ex-claim">मुख्य दाबी</label>
                    <textarea
                      id="ex-claim"
                      className={emiStyles.emiNumberInput}
                      rows={2}
                      value={extractEditForm.माग_दाबी.मुख्य_दाबी ?? ""}
                      onChange={(e) =>
                        patchExtraction((f) => ({
                          ...f,
                          माग_दाबी: {
                            ...f.माग_दाबी,
                            मुख्य_दाबी: e.target.value || null,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className={emiStyles.emiField}>
                    <label htmlFor="ex-fee">अदालत शुल्क दाबी</label>
                    <textarea
                      id="ex-fee"
                      className={emiStyles.emiNumberInput}
                      rows={2}
                      value={extractEditForm.माग_दाबी.अदालत_शुल्क_दाबी ?? ""}
                      onChange={(e) =>
                        patchExtraction((f) => ({
                          ...f,
                          माग_दाबी: {
                            ...f.माग_दाबी,
                            अदालत_शुल्क_दाबी: e.target.value || null,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className={emiStyles.emiField}>
                    <label htmlFor="ex-evidence">प्रमाणहरू (एक पङ्क्तिमा एक)</label>
                    <textarea
                      id="ex-evidence"
                      className={emiStyles.emiNumberInput}
                      rows={3}
                      value={extractEditForm.प्रमाणहरू.join("\n")}
                      onChange={(e) =>
                        patchExtraction((f) => ({
                          ...f,
                          प्रमाणहरू: e.target.value
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                    />
                  </div>
                  <div className={emiStyles.emiField}>
                    <label htmlFor="ex-witnesses">साक्षीहरू (एक पङ्क्तिमा एक)</label>
                    <textarea
                      id="ex-witnesses"
                      className={emiStyles.emiNumberInput}
                      rows={3}
                      value={extractEditForm.साक्षीहरू.join("\n")}
                      onChange={(e) =>
                        patchExtraction((f) => ({
                          ...f,
                          साक्षीहरू: e.target.value
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                    />
                  </div>

                  <div className={caseChatStyles.formActions} style={{ marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      className={pageStyles.contactSubmit}
                      style={{ margin: 0 }}
                      disabled={extractSaving || (!extractDirty && extractIsSaved)}
                      onClick={() => void handleSaveExtraction()}
                    >
                      {extractSaving
                        ? t.extractorSaving
                        : extractIsSaved && !extractDirty
                          ? t.extractorSaved
                          : t.extractorSave}
                    </button>
                  </div>
                </article>
              ) : null}
            </section>

            <h3 className={emiStyles.emiPanelTitle}>{t.documentGeneratorTitle}</h3>
            <p className={emiStyles.emiFieldHint}>{t.documentGeneratorHint}</p>
            {detail.courtType ? (
              <p className={pageStyles.calculatorSubtitle} style={{ marginTop: 0 }}>
                {t.documentTemplatesCount
                  .replace("{court}", courtTypeLabel)
                  .replace("{n}", String(courtTemplates.length))}
              </p>
            ) : (
              <p className={pageStyles.calculatorSubtitle} style={{ marginTop: 0 }}>
                {t.documentTemplatesNoCourtType}
              </p>
            )}

            {detail.courtType ? (
              <div style={{ marginBottom: "1rem" }}>
                <div className={emiStyles.emiField} style={{ marginBottom: "0.75rem" }}>
                  <label htmlFor="sk-template-search">{t.documentTemplatesSearch}</label>
                  <input
                    id="sk-template-search"
                    className={emiStyles.emiNumberInput}
                    value={templateSearch}
                    onChange={(e) => {
                      setTemplateSearch(e.target.value);
                      setTemplatePage(1);
                    }}
                    placeholder={t.documentTemplatesSearch}
                  />
                </div>

                {courtTemplatesLoading ? (
                  <p className={pageStyles.calculatorSubtitle}>
                    {t.documentTemplatesLoading}
                  </p>
                ) : courtTemplatesError ? (
                  <p className={pageStyles.contactError}>{courtTemplatesError}</p>
                ) : filteredCourtTemplates.length === 0 ? (
                  <p className={pageStyles.calculatorSubtitle}>
                    {t.documentTemplatesEmpty}
                  </p>
                ) : (
                  <>
                    <div className={emiStyles.emiPresets}>
                      {pagedCourtTemplates.map((template) => {
                        const primary =
                          locale === "ne"
                            ? template.name.ne || template.name.en
                            : template.name.en || template.name.ne;
                        const roman = template.name.roman?.trim() || "";
                        const starred = starredTemplateIds.includes(template.id);
                        return (
                          <TemplateStarChip
                            key={template.id}
                            starred={starred}
                            selected={activeFormTemplate?.id === template.id}
                            primary={primary}
                            secondary={roman || undefined}
                            starLabel={
                              locale === "ne" ? "बुकमार्क गर्नुहोस्" : "Bookmark"
                            }
                            unstarLabel={
                              locale === "ne"
                                ? "बुकमार्क हटाउनुहोस्"
                                : "Remove bookmark"
                            }
                            onToggleStar={() =>
                              void toggleStarredTemplate(template.id)
                            }
                            onSelect={() => {
                              setActiveFormTemplate(template);
                              setError("");
                            }}
                          />
                        );
                      })}
                    </div>
                    {filteredCourtTemplates.length > TEMPLATE_PAGE_SIZE ? (
                      <div
                        className="flex flex-wrap items-center justify-between gap-2"
                        style={{ marginTop: "0.75rem" }}
                      >
                        <span className={emiStyles.emiFieldHint} style={{ margin: 0 }}>
                          {`${(activeTemplatePage - 1) * TEMPLATE_PAGE_SIZE + 1}–${Math.min(
                            activeTemplatePage * TEMPLATE_PAGE_SIZE,
                            filteredCourtTemplates.length
                          )} / ${filteredCourtTemplates.length}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={pageStyles.skGateDemoBtn}
                            style={{
                              padding: "0.35rem 0.7rem",
                              fontSize: "0.75rem",
                              margin: 0,
                            }}
                            disabled={activeTemplatePage <= 1}
                            onClick={() =>
                              setTemplatePage((page) => Math.max(1, page - 1))
                            }
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            className={pageStyles.skGateDemoBtn}
                            style={{
                              padding: "0.35rem 0.7rem",
                              fontSize: "0.75rem",
                              margin: 0,
                            }}
                            disabled={activeTemplatePage >= templateTotalPages}
                            onClick={() =>
                              setTemplatePage((page) =>
                                Math.min(templateTotalPages, page + 1)
                              )
                            }
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            <div className={shellStyles.panelStack} style={{ gap: "0.65rem" }}>
              {(detail.documents?.length ?? 0) === 0 && (
                <p className={pageStyles.calculatorSubtitle}>{t.noDocuments}</p>
              )}
              {(detail.documents ?? [])
                .slice()
                .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
                .map((doc) => (
                  <article
                    key={doc.id}
                    className={emiStyles.emiFadeCard}
                    style={{ padding: "0.85rem" }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong style={{ color: "#042c53" }}>{doc.title}</strong>
                      <span className={emiStyles.emiFieldHint} style={{ margin: 0 }}>
                        {doc.status === "ready" ? t.docReadyBadge : t.docPlaceholderBadge}
                        {doc.savedUploadId ? ` · ${t.savedToCaseFiles}` : ""}
                        {" · "}
                        {formatDate(doc.createdAt)}
                      </span>
                    </div>
                    {doc.content && (
                      <pre
                        className={pageStyles.calculatorSubtitle}
                        style={{
                          margin: "0.65rem 0 0",
                          whiteSpace: "pre-wrap",
                          fontFamily: "inherit",
                        }}
                      >
                        {doc.content}
                      </pre>
                    )}
                    {isFirmUser && doc.status === "ready" && doc.content.trim() ? (
                      <div className={caseChatStyles.formActions} style={{ marginTop: "0.65rem" }}>
                        <button
                          type="button"
                          className={pageStyles.skGateDemoBtn}
                          style={{ padding: "0.4rem 0.85rem", fontSize: "0.8125rem", margin: 0 }}
                          disabled={savingDocId !== null}
                          onClick={() => void handleSaveGeneratedToFiles(doc.id)}
                        >
                          {savingDocId === doc.id
                            ? t.savingToCaseFiles
                            : doc.savedUploadId
                              ? t.saveToCaseFilesAgain
                              : t.saveToCaseFiles}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
            </div>
          </>
        )}
      </div>

      {activeFormTemplate && detail ? (
        <CaseDocumentModal
          caseId={detail.id}
          template={activeFormTemplate}
          locale={locale}
          onClose={() => setActiveFormTemplate(null)}
          onSaved={(upload) => {
            setUploads((prev) => [upload, ...prev]);
            setActiveTab("documents");
            setActiveFormTemplate(null);
          }}
          onQuotaError={(quota) => {
            setQuotaDialog({
              kind: "documents",
              used: quota.used,
              limit: quota.limit,
            });
          }}
        />
      ) : null}

      {filePreview && detail && (
        <CaseFilePreviewPanel
          url={filePreview.url}
          title={filePreview.title}
          mimeType={filePreview.mimeType}
          previewable={filePreview.previewable}
          unsupportedMessage={t.previewUnsupported}
          canEdit={canUploadFiles}
          caseId={detail.id}
          uploadId={filePreview.uploadId}
          labels={{
            close: t.closePreview,
            edit: t.editUpload,
            save: t.saveUpload,
            saving: t.savingUpload,
            cancelEdit: t.cancelEditUpload,
            editHint: t.editUploadHint,
            saved: t.uploadSaved,
            loadingPreview: t.loadingPreview,
          }}
          onClose={closeFilePreview}
          onSaved={(updated) => {
            setUploads((rows) =>
              rows.map((row) =>
                row.id === updated.id
                  ? { ...row, size: updated.size, updatedAt: updated.updatedAt }
                  : row
              )
            );
          }}
        />
      )}
    </div>
  );
}
