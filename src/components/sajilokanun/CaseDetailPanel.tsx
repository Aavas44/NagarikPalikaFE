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
  fetchCaseUploads,
  generateCaseDocument,
  markCaseMessagesRead,
  removeCaseParticipant,
  renameCaseUpload,
  sendCaseMessage,
  uploadCaseDocument,
  type CaseActivityRecord,
  type CaseActivityType,
  type CaseChatMessage,
  type CaseParticipantRecord,
  type CaseUploadedDocumentRecord,
  type LegalCaseDetail,
  type LegalCaseDocumentKind,
  type LegalCaseRecord,
} from "@/lib/sajilokanun-access";
import {
  bsToAd,
  daysBetweenAd,
  formatBsDate,
  getTodayBs,
  type BsDate,
} from "@/lib/nepaliCalendar";
import { toDevanagariDigits } from "@/lib/sajilokanun/nepali-digits";
import { useLanguage } from "@/context/LanguageContext";
import { NepaliDatePicker } from "@/components/sajilokanun/NepaliDatePicker";
import { SheetSelect } from "@/components/sajilokanun/SheetSelect";
import emiStyles from "@/components/user/emi.module.css";
import pageStyles from "@/app/user.module.css";
import shellStyles from "@/components/sajilokanun/SajiloKanunAppShell.module.css";
import chatStyles from "@/components/sajilokanun/ChatMessage.module.css";
import caseChatStyles from "@/components/sajilokanun/CaseChat.module.css";
import { CaseFilePreviewPanel } from "@/components/sajilokanun/CaseFilePreviewPanel";

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
  cancelCreateUser: string;
  createUserButton: string;
  tabMessages: string;
  unreadMessagesBadge: string;
  tabUsers: string;
  tabPayments: string;
  tabDocuments: string;
  tabDocumentGenerator: string;
  tabActivity: string;
  activityTitle: string;
  activityHint: string;
  activityTypeLabel: string;
  activityDateLabel: string;
  activityNoteLabel: string;
  activityNotePlaceholder: string;
  addActivity: string;
  cancelAddActivity: string;
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
  docGroupPleadings: string;
  docGroupGeneral: string;
  comingSoonAi: string;
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

const DOCUMENT_OPTIONS: {
  kind: LegalCaseDocumentKind;
  group: "pleadings" | "general";
  labelKey:
    | "docFiradpatra"
    | "docPratiuttarapatra"
    | "docVakalatnama"
    | "docWarisnama"
    | "docNivedanAwedan";
}[] = [
  { kind: "firadpatra", group: "pleadings", labelKey: "docFiradpatra" },
  { kind: "pratiuttarapatra", group: "pleadings", labelKey: "docPratiuttarapatra" },
  { kind: "vakalatnama", group: "general", labelKey: "docVakalatnama" },
  { kind: "warisnama", group: "general", labelKey: "docWarisnama" },
  { kind: "nivedan_awedan", group: "general", labelKey: "docNivedanAwedan" },
];

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
  const { locale } = useLanguage();
  const [detail, setDetail] = useState<LegalCaseDetail | null>(null);
  const [participants, setParticipants] = useState<CaseParticipantRecord[]>([]);
  const [messages, setMessages] = useState<CaseChatMessage[]>([]);
  const [unreadFromClient, setUnreadFromClient] = useState(0);
  const [activities, setActivities] = useState<CaseActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [generatingKind, setGeneratingKind] = useState<LegalCaseDocumentKind | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<
    "messages" | "users" | "documents" | "generator" | "payments" | "activity"
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
  const chatEndRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    setActiveTab("messages");
    setShowUserForm(false);
    setShowActivityForm(false);
    setUnreadFromClient(0);
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
  }, [caseId, isFirmUser]);

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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
      setMessages((prev) => [...prev, message]);
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

  async function handleGenerate(kind: LegalCaseDocumentKind) {
    if (!detail || !isFirmUser) return;
    setGeneratingKind(kind);
    setError("");
    try {
      const next = await generateCaseDocument(detail.id, kind);
      setDetail(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.detailError);
    } finally {
      setGeneratingKind(null);
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
        </div>

        {activeTab === "messages" && (
          <>
            <h3 className={emiStyles.emiPanelTitle}>{t.chatTitle}</h3>
            <p className={emiStyles.emiFieldHint}>{t.chatHint}</p>

            <div className={caseChatStyles.chatWindow}>
              {chatLoading ? (
                <p className={pageStyles.calculatorSubtitle}>{t.chatLoading}</p>
              ) : messages.length === 0 ? (
                <p className={pageStyles.calculatorSubtitle}>{t.chatEmpty}</p>
              ) : (
                messages.map((message) => {
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
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className={caseChatStyles.composer}>
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

        {isFirmUser && activeTab === "generator" && (
          <>
            <h3 className={emiStyles.emiPanelTitle}>{t.documentGeneratorTitle}</h3>
            <p className={emiStyles.emiFieldHint}>{t.documentGeneratorHint}</p>
            <p className={pageStyles.calculatorSubtitle} style={{ marginTop: 0 }}>
              {t.comingSoonAi}
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <p className={emiStyles.emiFieldHint} style={{ marginBottom: "0.4rem" }}>
                {t.docGroupPleadings}
              </p>
              <div className={emiStyles.emiPresets}>
                {DOCUMENT_OPTIONS.filter((d) => d.group === "pleadings").map((doc) => (
                  <button
                    key={doc.kind}
                    type="button"
                    className={emiStyles.emiPreset}
                    disabled={generatingKind !== null}
                    onClick={() => void handleGenerate(doc.kind)}
                  >
                    {generatingKind === doc.kind ? t.generating : t[doc.labelKey]}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <p className={emiStyles.emiFieldHint} style={{ marginBottom: "0.4rem" }}>
                {t.docGroupGeneral}
              </p>
              <div className={emiStyles.emiPresets}>
                {DOCUMENT_OPTIONS.filter((d) => d.group === "general").map((doc) => (
                  <button
                    key={doc.kind}
                    type="button"
                    className={emiStyles.emiPreset}
                    disabled={generatingKind !== null}
                    onClick={() => void handleGenerate(doc.kind)}
                  >
                    {generatingKind === doc.kind ? t.generating : t[doc.labelKey]}
                  </button>
                ))}
              </div>
            </div>

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
                  </article>
                ))}
            </div>
          </>
        )}
      </div>

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
