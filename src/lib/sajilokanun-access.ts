import type { UsageLogResponse, UsageSummary } from "@/lib/sajilokanun/token-usage";

const TOKEN_KEY = "sajilo_kanun_token";
const TOKEN_COOKIE = "sajilo_kanun_token";
const TOKEN_MAX_AGE = 30 * 24 * 60 * 60;
const DEMO_SESSION_KEY = "sajilo_kanun_demo_session_id";
const DEMO_SUBMITTED_KEY = "sajilo_kanun_demo_submitted";

export interface SajiloKanunUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  active?: boolean;
  teamId?: string | null;
  role?: "admin" | "member" | "caseUser" | null;
  teamName?: string | null;
}

export interface SajiloKanunDailyQuota {
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt?: string;
  questionId?: string | null;
}

export function isQuotaExhausted(quota: SajiloKanunDailyQuota | null | undefined): boolean {
  if (!quota) return false;
  if (quota.limit == null || quota.remaining == null) return false;
  return quota.remaining <= 0;
}

export type FirmQuotaErrorCode =
  | "firm_case_quota"
  | "firm_documents_quota"
  | "firm_ai_quota";

export class FirmQuotaError extends Error {
  code: FirmQuotaErrorCode;
  used: number;
  limit: number;

  constructor(input: {
    message: string;
    code: FirmQuotaErrorCode;
    used: number;
    limit: number;
  }) {
    super(input.message);
    this.name = "FirmQuotaError";
    this.code = input.code;
    this.used = input.used;
    this.limit = input.limit;
  }
}

export function isFirmQuotaError(err: unknown): err is FirmQuotaError {
  return err instanceof FirmQuotaError;
}

function throwIfFirmQuotaResponse(res: Response, data: {
  error?: string;
  code?: string;
  used?: number;
  limit?: number;
}): void {
  if (
    res.status === 429 &&
    (data.code === "firm_case_quota" ||
      data.code === "firm_documents_quota" ||
      data.code === "firm_ai_quota") &&
    typeof data.used === "number" &&
    typeof data.limit === "number"
  ) {
    throw new FirmQuotaError({
      message: data.error ?? "Firm quota reached",
      code: data.code,
      used: data.used,
      limit: data.limit,
    });
  }
}

export function setSajiloKanunToken(token: string): void {
  document.cookie = `${TOKEN_COOKIE}=${token}; path=/; max-age=${TOKEN_MAX_AGE}; SameSite=Lax`;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSajiloKanunToken(): void {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  localStorage.removeItem(TOKEN_KEY);
}

export function logoutSajiloKanun(): void {
  clearSajiloKanunToken();
}

export function getSajiloKanunToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromStorage = localStorage.getItem(TOKEN_KEY);
  if (fromStorage) return fromStorage;
  const match = document.cookie.match(/(?:^|;\s*)sajilo_kanun_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function hasSajiloKanunToken(): boolean {
  const token = getSajiloKanunToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { userType?: string };
    return payload.userType === "sajilo_kanun";
  } catch {
    return false;
  }
}

export async function fetchSajiloKanunMe(): Promise<SajiloKanunUser> {
  const token = getSajiloKanunToken();
  if (!token) throw new Error("Not signed in");

  const res = await fetch("/api/sajilokanun-auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load profile");
  return data.user as SajiloKanunUser;
}

export async function fetchSajiloKanunQuota(): Promise<{
  plan: "individual" | "firm";
  quota: SajiloKanunDailyQuota | null;
  firmQuota?: FirmQuotaSnapshot;
}> {
  const res = await skAuthedFetch("/api/sajilokanun-auth/quota");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load query allowance");
  return data;
}

export function getSkRoleFromToken(): "admin" | "member" | "caseUser" | null {
  const token = getSajiloKanunToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { role?: string };
    if (
      payload.role === "admin" ||
      payload.role === "member" ||
      payload.role === "caseUser"
    ) {
      return payload.role;
    }
    return null;
  } catch {
    return null;
  }
}

export function sajiloKanunPostLoginPath(): string {
  const role = getSkRoleFromToken();
  if (role === "caseUser") return "/sajilokanun/cases";
  if (role === "admin" || role === "member") return "/sajilokanun/dashboard";
  return "/sajilokanun/chat";
}

/** Firm id from JWT — available immediately on navigation (before /me resolves). */
export function getSkTeamIdFromToken(): string | null {
  const token = getSajiloKanunToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as {
      teamId?: string | null;
    };
    const teamId = payload.teamId?.trim();
    return teamId || null;
  } catch {
    return null;
  }
}

export function isCaseUserRole(
  role?: string | null
): role is "caseUser" {
  return role === "caseUser";
}

export interface TeamMember {
  id: string;
  username: string;
  name: string;
  email: string;
  contactNo?: string;
  active: boolean;
  role: "admin" | "member" | "caseUser" | null;
  userType?: string | null;
  teamId?: string | null;
  firmName?: string | null;
  createdAt?: string;
  createdBy?: string | null;
  createdByName?: string | null;
}

export type DirectoryUserType =
  | "superadmin"
  | "admin"
  | "firm_admin"
  | "member"
  | "case_user";

export type RoleKey =
  | "platform.superadmin"
  | "platform.admin"
  | "sk.firm_admin"
  | "sk.member"
  | "sk.individual"
  | "sk.case_user";

export interface RolePermissionDefinition {
  key: string;
  label: string;
  description: string;
  roles: RoleKey[];
  locked?: boolean;
}

export interface RolePolicyRecord {
  key: RoleKey;
  name: string;
  scope: "Platform" | "Sajilo Kanun";
  description: string;
  defaultPermissions: string[];
  permissions: string[];
  updatedAt?: string | null;
}

export interface DirectoryAssignedCase {
  id: string;
  title: string;
  caseNo: string;
  status: string;
}

export interface DirectoryPerson {
  id: string;
  kind: "platform" | "firm";
  name: string;
  email: string;
  contactNo?: string;
  username: string;
  active: boolean;
  teamId?: string | null;
  firmName?: string | null;
  role?: "admin" | "member" | "caseUser" | null;
  userType?: string | null;
  directoryUserType?: DirectoryUserType;
  createdAt?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  assignedCases?: DirectoryAssignedCase[];
}

export type CourtCategoryId =
  | "special_courts"
  | "high_courts"
  | "district_courts";

export interface LegalCaseRecord {
  id: string;
  teamId: string;
  title: string;
  caseNo: string;
  type: "civil" | "criminal" | "special_administrative" | "constitutional_writ";
  status: "open" | "pending" | "closed";
  partySide: "plaintiff" | "defendant" | "other";
  notes: string;
  courtId?: string | null;
  courtCode?: string | null;
  courtName?: string | null;
  courtNameEn?: string | null;
  courtScDailyId?: number | null;
  courtCategory?: CourtCategoryId | null;
  /** district | high | supreme | special */
  courtType?: import("@/lib/sajilokanun/court-type").CourtType | null;
  assignedMemberIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  testimonialCount?: number;
  paymentCount?: number;
  documentCount?: number;
  hasDocumentExtraction?: boolean;
  hasFamilyTree?: boolean;
}

export type LegalCaseDocumentKind =
  | "firadpatra"
  | "pratiuttarapatra"
  | "vakalatnama"
  | "warisnama"
  | "nivedan_awedan"
  | "adhikrit_warisnama"
  | "sadharan_warisnama"
  | "manjurinama"
  | "sampatti_rokka_nivedan"
  | "sampatti_fukuwa_nivedan"
  | "tayari_fatbari_nivedan"
  | "court_fee_subidha_nivedan"
  | "milis_jhikaune_nivedan"
  | "petboli_manish_bhuji_nivedan"
  | "sakkal_kagaj_pesh_nivedan"
  | "hajir_huna_aayeko_nivedan";

export interface CaseTestimonial {
  id: string;
  contactName: string;
  contactPhone: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface CasePayment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  note: string;
  paidAt: string;
  createdBy: string;
  createdAt: string;
}

export interface CaseGeneratedDocument {
  id: string;
  kind: LegalCaseDocumentKind;
  title: string;
  status: "placeholder" | "ready";
  content: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  savedUploadId?: string | null;
}

export interface CaseDocumentExtractionRecord {
  facts: import("@/lib/sajilokanun/document-prompts").ExtractedCaseDocument;
  sourceFileNames: string[];
  model: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalCaseDetail extends LegalCaseRecord {
  testimonials?: CaseTestimonial[];
  payments?: CasePayment[];
  documents?: CaseGeneratedDocument[];
  documentExtraction?: CaseDocumentExtractionRecord | null;
  hasDocumentExtraction?: boolean;
}

export interface CaseParticipantRecord {
  id: string;
  caseId: string;
  teamId: string;
  accountId: string;
  status: "active" | "revoked";
  addedBy: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  username: string;
  contactNo: string;
  email: string;
  accountActive: boolean;
}

export interface CaseChatMessage {
  id: string;
  caseId: string;
  teamId: string;
  senderAccountId: string;
  senderType: "firm" | "client";
  senderName: string;
  senderUsername: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface FirmQuotaBucket {
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface FirmQuotaSnapshot {
  plan: "firm";
  aiRequests: FirmQuotaBucket;
  cases: FirmQuotaBucket;
  documents: FirmQuotaBucket;
}

export interface AdminTeam {
  id: string;
  name: string;
  active: boolean;
  memberCount?: number;
  aiRequestsLimit?: number | null;
  casesLimit?: number | null;
  documentsLimit?: number | null;
  aiRequestsUsed?: number;
  firmQuota?: FirmQuotaSnapshot;
  createdAt: string;
}

async function skAuthedFetch(path: string, options: RequestInit = {}) {
  const token = getSajiloKanunToken();
  if (!token) throw new Error("Not signed in");
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await skAuthedFetch("/api/sajilokanun-auth/team/members");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load members");
  return data as TeamMember[];
}

export async function createTeamMember(input: {
  username: string;
  password: string;
  name: string;
  email?: string;
}): Promise<TeamMember> {
  const res = await skAuthedFetch("/api/sajilokanun-auth/team/members", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create member");
  return data as TeamMember;
}

export async function updateTeamMember(
  id: string,
  input: { active?: boolean; password?: string }
): Promise<TeamMember> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/team/members/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update member");
  return data as TeamMember;
}

export interface FetchCasesOptions {
  search?: string;
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface FetchCasesResponse {
  cases: LegalCaseRecord[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function fetchCases(options?: FetchCasesOptions): Promise<FetchCasesResponse> {
  const params = new URLSearchParams();
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.type && options.type !== "all") params.set("type", options.type);
  if (options?.status && options.status !== "all") params.set("status", options.status);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));

  const query = params.toString();
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases${query ? `?${query}` : ""}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load cases");

  if (Array.isArray(data)) {
    return {
      cases: data,
      totalCount: data.length,
      page: 1,
      limit: data.length || 10,
      totalPages: 1,
    };
  }

  return data as FetchCasesResponse;
}

export async function createCase(input: {
  title: string;
  caseNo: string;
  type: LegalCaseRecord["type"];
  status?: LegalCaseRecord["status"];
  partySide?: LegalCaseRecord["partySide"];
  notes?: string;
  courtType: import("@/lib/sajilokanun/court-type").CourtType;
  courtId?: string;
  courtCode?: string;
  assignedMemberIds?: string[];
  documentExtraction?: {
    facts: import("@/lib/sajilokanun/document-prompts").ExtractedCaseDocument;
    sourceFileNames?: string[];
    model?: string;
  };
}): Promise<LegalCaseRecord> {
  const res = await skAuthedFetch("/api/sajilokanun-auth/cases", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throwIfFirmQuotaResponse(res, data);
    throw new Error(data.error ?? "Failed to create case");
  }
  return data as LegalCaseRecord;
}

export async function updateCase(
  id: string,
  input: Partial<{
    title: string;
    caseNo: string;
    type: LegalCaseRecord["type"];
    status: LegalCaseRecord["status"];
    partySide: LegalCaseRecord["partySide"];
    notes: string;
    courtType: import("@/lib/sajilokanun/court-type").CourtType;
    courtId: string;
    courtCode: string;
    assignedMemberIds: string[];
  }>
): Promise<LegalCaseRecord> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update case");
  return data as LegalCaseRecord;
}

export async function fetchCaseDetail(id: string): Promise<LegalCaseDetail> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load case");
  return data as LegalCaseDetail;
}

export async function fetchCaseParticipants(
  caseId: string
): Promise<CaseParticipantRecord[]> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${caseId}/participants`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load case users");
  return data as CaseParticipantRecord[];
}

export async function createCaseParticipant(
  caseId: string,
  input: {
    name: string;
    username: string;
    password: string;
    contactNo?: string;
    email?: string;
  }
): Promise<CaseParticipantRecord> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${caseId}/participants`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create case user");
  return data as CaseParticipantRecord;
}

export async function removeCaseParticipant(
  caseId: string,
  participantId: string
): Promise<void> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/participants/${participantId}`,
    { method: "DELETE" }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to remove case user");
}

export async function fetchCaseMessages(
  caseId: string,
  options?: { markRead?: boolean }
): Promise<{ messages: CaseChatMessage[]; unreadFromClient: number }> {
  const params = new URLSearchParams();
  if (options?.markRead) params.set("markRead", "1");
  const qs = params.toString();
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/messages${qs ? `?${qs}` : ""}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load messages");
  return {
    messages: (data.messages ?? data) as CaseChatMessage[],
    unreadFromClient: Number(data.unreadFromClient ?? 0),
  };
}

export async function markCaseMessagesRead(
  caseId: string,
  lastReadMessageId?: string
): Promise<void> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/messages/read`,
    {
      method: "POST",
      body: JSON.stringify({ lastReadMessageId }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to mark messages read");
}

export async function sendCaseMessage(
  caseId: string,
  body: string
): Promise<CaseChatMessage> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${caseId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to send message");
  return data as CaseChatMessage;
}

export interface CaseUploadedDocumentRecord {
  id: string;
  caseId: string;
  teamId: string;
  uploadedBy: string;
  uploaderName: string;
  uploaderUsername: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export type CaseActivityType =
  | "case_registration"
  | "notice_service"
  | "reply_filing"
  | "hearing_date"
  | "witness_testimony";

export const CASE_ACTIVITY_TYPES: CaseActivityType[] = [
  "case_registration",
  "notice_service",
  "reply_filing",
  "hearing_date",
  "witness_testimony",
];

export interface CaseActivityRecord {
  id: string;
  caseId: string;
  teamId: string;
  activityType: CaseActivityType;
  labelEn: string;
  labelNe: string;
  bsYear: number;
  bsMonth: number;
  bsDay: number;
  activityDate: string;
  note: string;
  createdBy: string;
  createdByName: string;
  createdByUsername: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchCaseUploads(caseId: string): Promise<{
  maxBytes: number;
  accept: string;
  capabilities: { canUpload: boolean; canManageFiles: boolean };
  uploads: CaseUploadedDocumentRecord[];
}> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${caseId}/uploads`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load uploads");
  return {
    maxBytes: Number(data.maxBytes ?? 10 * 1024 * 1024),
    accept: String(data.accept ?? ""),
    capabilities: {
      canUpload: Boolean(data.capabilities?.canUpload ?? true),
      canManageFiles: Boolean(data.capabilities?.canManageFiles ?? false),
    },
    uploads: (data.uploads ?? []) as CaseUploadedDocumentRecord[],
  };
}

export async function uploadCaseDocument(
  caseId: string,
  input: { fileName: string; mimeType: string; data: string }
): Promise<CaseUploadedDocumentRecord> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${caseId}/uploads`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to upload document");
  return data as CaseUploadedDocumentRecord;
}

export async function deleteCaseUpload(
  caseId: string,
  uploadId: string
): Promise<void> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/uploads/${uploadId}`,
    { method: "DELETE" }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to delete document");
}

export async function renameCaseUpload(
  caseId: string,
  uploadId: string,
  fileName: string
): Promise<CaseUploadedDocumentRecord> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/uploads/${uploadId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ fileName }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to rename document");
  return data as CaseUploadedDocumentRecord;
}

/** In-app editable kinds (matches backend). */
export type CaseUploadEditableKind = "txt" | "docx";

export function getCaseUploadEditableKind(
  fileName: string,
  mimeType?: string
): CaseUploadEditableKind | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mime = (mimeType ?? "").toLowerCase();
  if (ext === "txt" || mime.startsWith("text/plain")) return "txt";
  if (
    ext === "docx" ||
    mime.includes("wordprocessingml") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return null;
}

/** Save edited .txt / .docx content. Writes to R2 only on this call (overwrite in place). */
export async function updateCaseUploadContent(
  caseId: string,
  uploadId: string,
  content: string
): Promise<CaseUploadedDocumentRecord> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/uploads/${uploadId}`,
    {
      method: "PUT",
      body: JSON.stringify({ content }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to save document");
  return data as CaseUploadedDocumentRecord;
}

export async function downloadCaseUpload(
  caseId: string,
  uploadId: string,
  fileName: string
): Promise<void> {
  const blob = await fetchCaseUploadBlob(caseId, uploadId, { download: true });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function fetchCaseUploadBlob(
  caseId: string,
  uploadId: string,
  options?: { download?: boolean }
): Promise<Blob> {
  const token = getSajiloKanunToken();
  if (!token) throw new Error("Not signed in");
  const qs = options?.download ? "?download=1" : "";
  const res = await fetch(
    `/api/sajilokanun-auth/cases/${caseId}/uploads/${uploadId}/download${qs}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to load document");
  }
  return res.blob();
}

const PREVIEW_MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain;charset=utf-8",
  csv: "text/csv;charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** Resolve a browser-friendly MIME for in-app preview. */
export function resolvePreviewMime(fileName: string, mimeType?: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (PREVIEW_MIME_BY_EXT[ext]) return PREVIEW_MIME_BY_EXT[ext];
  const mime = (mimeType || "").toLowerCase().trim();
  if (mime && mime !== "application/octet-stream") return mime;
  return "application/octet-stream";
}

/** File types we can show in the in-app preview panel. */
export function isBrowserPreviewableMime(mimeType: string, fileName: string): boolean {
  const mime = (mimeType || "").toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mime.includes("pdf") || ext === "pdf") return true;
  if (mime.startsWith("text/") || ext === "txt" || ext === "csv") return true;
  if (mime.startsWith("image/")) return true;
  // .docx via mammoth HTML conversion (legacy .doc is not supported)
  if (
    ext === "docx" ||
    mime.includes("wordprocessingml") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return true;
  }
  return false;
}

export async function openCaseUploadInBrowser(
  caseId: string,
  uploadId: string,
  fileName: string,
  mimeType: string
): Promise<{ url: string; previewable: boolean; mimeType: string }> {
  const blob = await fetchCaseUploadBlob(caseId, uploadId, { download: false });
  const resolvedMime = resolvePreviewMime(fileName, mimeType || blob.type);
  const previewable = isBrowserPreviewableMime(resolvedMime, fileName);
  // Rebuild bytes with an explicit type — some browsers ignore response Content-Type
  // on blob URLs and download when type is missing/octet-stream.
  const typed = new Blob([await blob.arrayBuffer()], { type: resolvedMime });
  const url = URL.createObjectURL(typed);
  return { url, previewable, mimeType: resolvedMime };
}

export async function fetchCaseActivities(
  caseId: string
): Promise<CaseActivityRecord[]> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${caseId}/activities`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load activities");
  return (data.activities ?? []) as CaseActivityRecord[];
}

export interface CasePesiColumn {
  key: string;
  labelNe: string;
  labelEn: string;
}

export interface CasePesiRowRecord {
  id: string;
  caseId: string;
  teamId: string;
  courtScDailyId: number;
  pesiDate: string;
  sn: string;
  caseNoRaw: string;
  registrationDate: string;
  matter: string;
  parties: string;
  fantawala: string;
  signal: string;
  priority: string;
  remarks: string;
  cells: string[];
  fetchedAt: string;
  fetchedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CasePesiListResponse {
  columns: CasePesiColumn[];
  courtScDailyId: number | null;
  caseNo: string;
  rows: CasePesiRowRecord[];
  totalRowsScanned?: number;
  matchedCount?: number;
  fetchedAt?: string;
}

export async function fetchCasePesiRows(
  caseId: string
): Promise<CasePesiListResponse> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${caseId}/pesi`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load pesi rows");
  return data as CasePesiListResponse;
}

export async function fetchSupremeCourtPesiForCase(
  caseId: string
): Promise<CasePesiListResponse> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/pesi/fetch`,
    { method: "POST" }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to fetch pesi");
  return data as CasePesiListResponse;
}

export type DashboardActivityUrgency =
  | "overdue"
  | "today"
  | "week"
  | "upcoming"
  | "past";

export interface DashboardActivityRecord extends CaseActivityRecord {
  urgency: DashboardActivityUrgency;
  caseTitle: string;
  caseNo: string;
  caseStatus: LegalCaseRecord["status"];
  caseType: LegalCaseRecord["type"];
  partySide: LegalCaseRecord["partySide"];
  courtName: string;
  courtNameEn: string;
}

export interface DashboardPesiRecord extends CasePesiRowRecord {
  urgency: DashboardActivityUrgency;
  bsYear: number;
  bsMonth: number;
  bsDay: number;
  activityType: "hearing_date";
  labelEn: string;
  labelNe: string;
  caseTitle: string;
  caseNo: string;
  caseStatus: LegalCaseRecord["status"];
  caseType: LegalCaseRecord["type"];
  partySide: LegalCaseRecord["partySide"];
  courtName: string;
  courtNameEn: string;
}

export interface FirmActivityDashboard {
  summary: {
    total: number;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    upcoming: number;
    openCases: number;
  };
  activities: DashboardActivityRecord[];
  pesiRows: DashboardPesiRecord[];
}

export interface UnreadClientThread {
  caseId: string;
  caseTitle: string;
  caseNo: string;
  caseStatus: string;
  unreadCount: number;
  latestMessageId: string;
  latestBody: string;
  latestSenderName: string;
  latestAt: string;
}

export interface FirmUnreadMessages {
  totalUnread: number;
  threads: UnreadClientThread[];
}

export async function fetchFirmActivityDashboard(): Promise<FirmActivityDashboard> {
  const res = await skAuthedFetch("/api/sajilokanun-auth/dashboard/activities");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load dashboard");
  const payload = data as FirmActivityDashboard;
  return {
    ...payload,
    activities: payload.activities ?? [],
    pesiRows: payload.pesiRows ?? [],
  };
}

export interface FirmPesiRefreshResult {
  casesProcessed: number;
  casesSkipped: number;
  matchedCount: number;
  courtsFetched: number;
  errors: { caseId: string; caseNo: string; error: string }[];
}

export async function refreshFirmDashboardPesi(): Promise<FirmPesiRefreshResult> {
  const res = await skAuthedFetch("/api/sajilokanun-auth/dashboard/pesi/fetch", {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to refresh court pesi");
  return data as FirmPesiRefreshResult;
}

export async function fetchFirmUnreadMessages(): Promise<FirmUnreadMessages> {
  const res = await skAuthedFetch("/api/sajilokanun-auth/dashboard/unread-messages");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load unread messages");
  return data as FirmUnreadMessages;
}

export interface CourtRecord {
  id: string;
  code: string;
  category: CourtCategoryId;
  categoryLabelEn: string;
  categoryLabelNe: string;
  name: string;
  nameEn: string | null;
  scDailyId: number | null;
  scDailyUrl: string | null;
  sortOrder: number;
  active: boolean;
}

export interface CourtCategoryGroup {
  id: CourtCategoryId;
  labelEn: string;
  labelNe: string;
  courts: CourtRecord[];
}

export interface CourtsCatalog {
  categories: CourtCategoryGroup[];
  courts: CourtRecord[];
}

export async function fetchCourtsCatalog(): Promise<CourtsCatalog> {
  const res = await skAuthedFetch("/api/sajilokanun-auth/courts");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load courts");
  return data as CourtsCatalog;
}

export async function createCaseActivity(
  caseId: string,
  input: {
    activityType: CaseActivityType;
    bsYear: number;
    bsMonth: number;
    bsDay: number;
    activityDate: string;
    note?: string;
  }
): Promise<CaseActivityRecord> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${caseId}/activities`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to add activity");
  return data as CaseActivityRecord;
}

export async function deleteCaseActivity(
  caseId: string,
  activityId: string
): Promise<void> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/activities/${activityId}`,
    { method: "DELETE" }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to delete activity");
}

export async function addCaseTestimonial(
  caseId: string,
  input: { contactName: string; contactPhone: string; content: string }
): Promise<LegalCaseDetail> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${caseId}/testimonials`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to add testimonial");
  return data as LegalCaseDetail;
}

export async function deleteCaseTestimonial(
  caseId: string,
  itemId: string
): Promise<LegalCaseDetail> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/testimonials/${itemId}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to delete testimonial");
  return data as LegalCaseDetail;
}

export async function addCasePayment(
  caseId: string,
  input: {
    amount: number;
    currency?: string;
    method?: string;
    note?: string;
    paidAt?: string;
  }
): Promise<LegalCaseDetail> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${caseId}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to add payment");
  return data as LegalCaseDetail;
}

export async function deleteCasePayment(
  caseId: string,
  itemId: string
): Promise<LegalCaseDetail> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/payments/${itemId}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to delete payment");
  return data as LegalCaseDetail;
}

export async function draftCaseDocument(options: {
  kind: LegalCaseDocumentKind;
  inputs: unknown;
}): Promise<{ kind: LegalCaseDocumentKind; content: string }> {
  const res = await fetch("/api/sajilokanun/generate-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: options.kind,
      inputs: options.inputs,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to draft document");
  }
  return data as { kind: LegalCaseDocumentKind; content: string };
}

export type ExtractDocumentFilePayload = {
  fileName: string;
  mimeType: string;
  /** Raw base64 (no data: prefix required). */
  data: string;
};

export async function extractCaseDocumentFacts(options: {
  files: ExtractDocumentFilePayload[];
}): Promise<{
  extracted: import("@/lib/sajilokanun/document-prompts").ExtractedCaseDocument;
  model: string;
  fileNames: string[];
}> {
  const res = await fetch("/api/sajilokanun/extract-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: options.files }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to extract document facts");
  }
  return data;
}

export async function saveCaseDocumentExtraction(
  caseId: string,
  options: {
    facts: import("@/lib/sajilokanun/document-prompts").ExtractedCaseDocument;
    sourceFileNames?: string[];
    model?: string;
  }
): Promise<LegalCaseDetail> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/extraction`,
    {
      method: "PUT",
      body: JSON.stringify({
        facts: options.facts,
        sourceFileNames: options.sourceFileNames ?? [],
        model: options.model ?? "",
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to save extraction");
  }
  return data as LegalCaseDetail;
}

export async function fileToBase64Payload(file: File): Promise<ExtractDocumentFilePayload> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    data: btoa(binary),
  };
}

export async function blobToBase64Payload(
  blob: Blob,
  fileName: string,
  mimeType?: string
): Promise<ExtractDocumentFilePayload> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    fileName,
    mimeType: mimeType || blob.type || "application/octet-stream",
    data: btoa(binary),
  };
}

export type SkPublishedDocumentTemplate = {
  id: string;
  slug: string;
  name: { en: string; ne: string; roman?: string };
  description: { en: string; ne: string };
  courtType: import("@/lib/sajilokanun/court-type").CourtType;
  documentKind: string;
  documentKindTitle: string;
  variables: Array<{
    key: string;
    label: { en: string; ne: string };
    type: "text" | "date" | "number";
    required: boolean;
  }>;
  fileType: "docx" | "pdf";
  originalFileName: string;
  status: "draft" | "published";
  hasFile: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Published templates for the given court tier (firm Document Generator). */
export async function fetchSkDocumentTemplates(
  courtType: import("@/lib/sajilokanun/court-type").CourtType
): Promise<SkPublishedDocumentTemplate[]> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/document-templates?courtType=${encodeURIComponent(courtType)}`
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load document templates");
  }
  return data as SkPublishedDocumentTemplate[];
}

export type SkTemplateFormField = {
  key: string;
  label: { en: string; ne: string };
  type: "text" | "date" | "number";
  required: boolean;
  section?: string;
};

export async function fetchSkTemplateFields(templateId: string): Promise<{
  placeholderKeys: string[];
  userFields: SkTemplateFormField[];
}> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/document-templates/${templateId}/fields`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load template fields");
  return data as { placeholderKeys: string[]; userFields: SkTemplateFormField[] };
}

async function fetchSkDocumentBlob(
  path: string,
  body: unknown
): Promise<{ blob: Blob; fileName: string }> {
  const token = getSajiloKanunToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throwIfFirmQuotaResponse(res, data);
    throw new Error(data.error ?? "Failed to generate document");
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const fileName = match?.[1]
    ? decodeURIComponent(match[1])
    : "document.docx";
  return { blob: await res.blob(), fileName };
}

export async function previewSkCaseDocument(input: {
  caseId: string;
  templateId: string;
  variables: Record<string, string>;
}): Promise<{ blob: Blob; fileName: string }> {
  return fetchSkDocumentBlob(
    `/api/sajilokanun-auth/cases/${input.caseId}/document-templates/preview`,
    { templateId: input.templateId, variables: input.variables }
  );
}

export async function generateSkCaseDocument(input: {
  caseId: string;
  templateId: string;
  variables: Record<string, string>;
}): Promise<{ blob: Blob; fileName: string }> {
  return fetchSkDocumentBlob(
    `/api/sajilokanun-auth/cases/${input.caseId}/document-templates/generate`,
    { templateId: input.templateId, variables: input.variables }
  );
}

export async function generateSkCaseDocumentWithAi(input: {
  caseId: string;
  templateId: string;
  variables: Record<string, string>;
}): Promise<{
  values: Record<string, string>;
  filledCount: number;
  fileName: string;
  contentType: string;
  blob: Blob;
}> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${input.caseId}/document-templates/generate-ai`,
    {
      method: "POST",
      body: JSON.stringify({
        templateId: input.templateId,
        variables: input.variables,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throwIfFirmQuotaResponse(res, data);
    throw new Error(data.error ?? "Failed to AI-generate document");
  }
  const contentType = String(
    data.contentType ??
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  const base64 = String(data.contentBase64 ?? "");
  if (!base64) {
    throw new Error("AI generate response missing document content");
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return {
    values:
      data.values && typeof data.values === "object"
        ? (data.values as Record<string, string>)
        : {},
    filledCount: Number(data.filledCount ?? 0),
    fileName: String(data.fileName ?? "document.docx"),
    contentType,
    blob: new Blob([bytes], { type: contentType }),
  };
}

export async function saveSkCaseDocument(input: {
  caseId: string;
  templateId: string;
  variables: Record<string, string>;
}): Promise<{ upload: CaseUploadedDocumentRecord; fileName: string }> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${input.caseId}/document-templates/save`,
    {
      method: "POST",
      body: JSON.stringify({
        templateId: input.templateId,
        variables: input.variables,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throwIfFirmQuotaResponse(res, data);
    throw new Error(data.error ?? "Failed to save document to case files");
  }
  return {
    upload: data.upload as CaseUploadedDocumentRecord,
    fileName: String(data.fileName ?? "document.docx"),
  };
}

export async function generateCaseDocument(
  caseId: string,
  kind: LegalCaseDocumentKind,
  options?: { content?: string }
): Promise<LegalCaseDetail> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/documents/generate`,
    {
      method: "POST",
      body: JSON.stringify({
        kind,
        ...(options?.content ? { content: options.content } : {}),
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throwIfFirmQuotaResponse(res, data);
    throw new Error(data.error ?? "Failed to generate document");
  }
  return data as LegalCaseDetail;
}

export async function saveGeneratedDocumentToCaseFiles(
  caseId: string,
  documentId: string
): Promise<LegalCaseDetail> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/documents/${documentId}/save-to-files`,
    { method: "POST" }
  );
  const data = await res.json();
  if (!res.ok) {
    throwIfFirmQuotaResponse(res, data);
    throw new Error(data.error ?? "Failed to save draft to case files");
  }
  return data as LegalCaseDetail;
}

export async function exportCaseFilesZip(
  caseId: string
): Promise<{ blob: Blob; fileName: string }> {
  const res = await skAuthedFetch(`/api/sajilokanun-auth/cases/${caseId}/export`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error ?? "Failed to export case files"
    );
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const asciiMatch = disposition.match(/filename="([^"]+)"/i);
  const fileName = utfMatch
    ? decodeURIComponent(utfMatch[1])
    : asciiMatch?.[1] ?? "case-files.zip";
  return { blob, fileName };
}

function shareInflight<T>(
  holder: { current: Promise<T> | null },
  run: () => Promise<T>
): Promise<T> {
  if (!holder.current) {
    holder.current = run().finally(() => {
      holder.current = null;
    });
  }
  return holder.current;
}

const teamsListInflight: { current: Promise<AdminTeam[]> | null } = {
  current: null,
};
const directoryInflight: { current: Promise<DirectoryPerson[]> | null } = {
  current: null,
};
const geminiKeysInflight: { current: Promise<GeminiApiKeyRecord[]> | null } = {
  current: null,
};

export async function adminFetchTeams(options?: {
  search?: string;
}): Promise<AdminTeam[]> {
  const search = options?.search?.trim();
  const run = async () => {
    const { authedFetch } = await import("@/lib/auth");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const query = params.toString();
    const res = await authedFetch(`/admin/teams${query ? `?${query}` : ""}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load teams");
    return data as AdminTeam[];
  };
  return search ? run() : shareInflight(teamsListInflight, run);
}

export async function adminCreateTeam(
  name: string,
  quotas?: {
    aiRequestsLimit?: number | null;
    casesLimit?: number | null;
    documentsLimit?: number | null;
  }
): Promise<AdminTeam> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/teams", {
    method: "POST",
    body: JSON.stringify({
      name,
      aiRequestsLimit: quotas?.aiRequestsLimit ?? null,
      casesLimit: quotas?.casesLimit ?? null,
      documentsLimit: quotas?.documentsLimit ?? null,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create team");
  return data as AdminTeam;
}

export async function adminUpdateTeam(
  id: string,
  input: {
    name?: string;
    active?: boolean;
    aiRequestsLimit?: number | null;
    casesLimit?: number | null;
    documentsLimit?: number | null;
  }
): Promise<AdminTeam> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/teams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update team");
  return data as AdminTeam;
}

export async function adminFetchTeamAccounts(teamId: string): Promise<TeamMember[]> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/teams/${teamId}/accounts`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load accounts");
  return data as TeamMember[];
}

export async function adminFetchTeamUsage(
  teamId: string,
  options?: { limit?: number; offset?: number; userId?: string }
): Promise<UsageLogResponse> {
  const { authedFetch } = await import("@/lib/auth");
  const params = new URLSearchParams();
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  if (options?.userId?.trim()) params.set("userId", options.userId.trim());
  const query = params.toString();
  const res = await authedFetch(
    `/admin/teams/${teamId}/usage${query ? `?${query}` : ""}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load team usage");
  return {
    summary: data.summary ?? data.usage,
    requests: data.requests ?? [],
    hasMore: Boolean(data.hasMore),
  } as UsageLogResponse;
}

export async function adminFetchAllAccounts(options?: {
  role?: "admin" | "member";
}): Promise<TeamMember[]> {
  const { authedFetch } = await import("@/lib/auth");
  const params = new URLSearchParams();
  if (options?.role) params.set("role", options.role);
  const query = params.toString();
  const res = await authedFetch(`/admin/accounts${query ? `?${query}` : ""}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load accounts");
  return data as TeamMember[];
}

export async function adminFetchDirectory(): Promise<DirectoryPerson[]> {
  return shareInflight(directoryInflight, async () => {
    const { authedFetch } = await import("@/lib/auth");
    const res = await authedFetch("/admin/directory");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load members directory");
    return Array.isArray(data) ? data : [];
  });
}

export async function adminFetchRolePolicies(): Promise<{
  roles: RolePolicyRecord[];
  permissions: RolePermissionDefinition[];
}> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/role-policies");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load role policies");
  return data;
}

export async function adminUpdateRolePolicy(
  roleKey: RoleKey,
  permissions: string[]
): Promise<RolePolicyRecord> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(
    `/admin/role-policies/${encodeURIComponent(roleKey)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ permissions }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update role policy");
  return data;
}

export async function adminCreateDirectoryPerson(input: {
  name: string;
  password: string;
  email?: string;
  contactNo?: string;
  username?: string;
  userType: DirectoryUserType;
  role: "superadmin" | "admin" | "firm_admin" | "member";
  firmId?: string;
}): Promise<DirectoryPerson> {
  const { authedFetch } = await import("@/lib/auth");
  const role =
    input.role === "firm_admin"
      ? "admin"
      : input.role === "member"
        ? "member"
        : input.role;

  const res = await authedFetch("/admin/directory", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      password: input.password,
      email: input.email,
      contactNo: input.contactNo,
      username: input.username,
      userType: input.userType,
      role,
      firmId: input.firmId,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create account");
  return data as DirectoryPerson;
}

export async function adminCreateTeamAccount(
  teamId: string,
  input: {
    username: string;
    password: string;
    name: string;
    email?: string;
    contactNo?: string;
    role: "admin" | "member";
  }
): Promise<TeamMember> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/teams/${teamId}/accounts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create account");
  return data as TeamMember;
}

export async function adminUpdateAccount(
  id: string,
  input: {
    active?: boolean;
    role?: "admin" | "member";
    password?: string;
    teamId?: string;
    contactNo?: string;
    name?: string;
    email?: string;
    username?: string;
  }
): Promise<TeamMember> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update account");
  return data as TeamMember;
}

export type SajiloKanunLoginResult =
  | { kind: "sajilo_kanun"; token: string; user: SajiloKanunUser }
  | { kind: "platform"; token: string; redirect: string }
  | { kind: "citizen"; redirect: string };

export async function loginSajiloKanun(
  username: string,
  password: string
): Promise<SajiloKanunLoginResult> {
  const res = await fetch("/api/sajilokanun-auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Login failed");
  }

  if (data.kind === "platform" && typeof data.token === "string") {
    const { setToken } = await import("@/lib/auth");
    setToken(data.token);
    return {
      kind: "platform",
      token: data.token,
      redirect: typeof data.redirect === "string" ? data.redirect : "/admin",
    };
  }

  if (data.kind === "citizen" && typeof data.token === "string" && typeof data.sajiloKanunToken === "string") {
    const { setToken } = await import("@/lib/auth");
    setToken(data.token);
    setSajiloKanunToken(data.sajiloKanunToken);
    return {
      kind: "citizen",
      redirect: typeof data.redirect === "string" ? data.redirect : "/sajilokanun/chat",
    };
  }

  setSajiloKanunToken(data.token);
  return data as { kind: "sajilo_kanun"; token: string; user: SajiloKanunUser };
}

export async function fetchSajiloKanunUsage(): Promise<UsageSummary> {
  const token = getSajiloKanunToken();
  if (!token) {
    throw new Error("Not signed in");
  }

  const res = await fetch("/api/sajilokanun-auth/usage", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load token usage");
  }
  return data.usage as UsageSummary;
}

export async function fetchSajiloKanunUsageLog(options?: {
  limit?: number;
  offset?: number;
}): Promise<UsageLogResponse> {
  const token = getSajiloKanunToken();
  if (!token) {
    throw new Error("Not signed in");
  }

  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  const query = params.toString();
  const res = await fetch(
    `/api/sajilokanun-auth/usage/log${query ? `?${query}` : ""}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load usage log");
  }
  return data;
}

export function getDemoSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(DEMO_SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(DEMO_SESSION_KEY, id);
  }
  return id;
}

export function hasSubmittedDemoThisSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(DEMO_SUBMITTED_KEY) === "1";
}

export function markDemoSubmittedThisSession(): void {
  sessionStorage.setItem(DEMO_SUBMITTED_KEY, "1");
}

export interface SubmitDemoRequestInput {
  sessionId: string;
  name: string;
  email: string;
  contactNo: string;
  profession: string;
  queries: string;
  locale: "en" | "ne";
}

export async function submitDemoRequest(input: SubmitDemoRequestInput) {
  const res = await fetch("/api/demo-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to submit demo request");
  }

  markDemoSubmittedThisSession();
  return data;
}

export type GeminiApiKeyRole = "default" | "fallback" | "pool";

export interface GeminiApiKeyRecord {
  id: string;
  label: string;
  keyHint: string;
  maskedKey: string;
  role: GeminiApiKeyRole;
  active: boolean;
  lastError: string;
  lastErrorAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  apiKey?: string;
}

export async function adminFetchGeminiKeys(options?: {
  revealId?: string;
}): Promise<GeminiApiKeyRecord[]> {
  const run = async () => {
    const { authedFetch } = await import("@/lib/auth");
    const qs = options?.revealId
      ? `?reveal=${encodeURIComponent(options.revealId)}`
      : "";
    const res = await authedFetch(`/admin/gemini-keys${qs}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load Gemini keys");
    return (data.keys ?? []) as GeminiApiKeyRecord[];
  };
  return options?.revealId ? run() : shareInflight(geminiKeysInflight, run);
}

export async function adminCreateGeminiKey(input: {
  label: string;
  apiKey: string;
  role?: GeminiApiKeyRole;
}): Promise<GeminiApiKeyRecord> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/gemini-keys", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to add Gemini key");
  return data as GeminiApiKeyRecord;
}

export async function adminUpdateGeminiKey(
  id: string,
  input: {
    label?: string;
    active?: boolean;
    setRole?: GeminiApiKeyRole;
  }
): Promise<GeminiApiKeyRecord> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/gemini-keys/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update Gemini key");
  return data as GeminiApiKeyRecord;
}

export async function adminDeleteGeminiKey(id: string): Promise<void> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/gemini-keys/${id}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to delete Gemini key");
}

