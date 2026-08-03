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
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
  questionId?: string | null;
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
  role: "admin" | "member" | null;
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

export interface LegalCaseRecord {
  id: string;
  teamId: string;
  title: string;
  caseNo: string;
  type: "civil" | "criminal" | "special_administrative" | "constitutional_writ";
  status: "open" | "pending" | "closed";
  partySide: "plaintiff" | "defendant" | "other";
  notes: string;
  assignedMemberIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  testimonialCount?: number;
  paymentCount?: number;
  documentCount?: number;
}

export type LegalCaseDocumentKind =
  | "firadpatra"
  | "pratiuttarapatra"
  | "vakalatnama"
  | "warisnama"
  | "nivedan_awedan";

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
}

export interface LegalCaseDetail extends LegalCaseRecord {
  testimonials?: CaseTestimonial[];
  payments?: CasePayment[];
  documents?: CaseGeneratedDocument[];
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

export interface AdminTeam {
  id: string;
  name: string;
  active: boolean;
  memberCount?: number;
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
  assignedMemberIds?: string[];
}): Promise<LegalCaseRecord> {
  const res = await skAuthedFetch("/api/sajilokanun-auth/cases", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create case");
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
  return data as FirmActivityDashboard;
}

export async function fetchFirmUnreadMessages(): Promise<FirmUnreadMessages> {
  const res = await skAuthedFetch("/api/sajilokanun-auth/dashboard/unread-messages");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load unread messages");
  return data as FirmUnreadMessages;
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

export async function generateCaseDocument(
  caseId: string,
  kind: LegalCaseDocumentKind
): Promise<LegalCaseDetail> {
  const res = await skAuthedFetch(
    `/api/sajilokanun-auth/cases/${caseId}/documents/generate`,
    {
      method: "POST",
      body: JSON.stringify({ kind }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to generate document");
  return data as LegalCaseDetail;
}

export async function adminFetchTeams(options?: {
  search?: string;
}): Promise<AdminTeam[]> {
  const { authedFetch } = await import("@/lib/auth");
  const params = new URLSearchParams();
  if (options?.search?.trim()) params.set("search", options.search.trim());
  const query = params.toString();
  const res = await authedFetch(`/admin/teams${query ? `?${query}` : ""}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load teams");
  return data as AdminTeam[];
}

export async function adminCreateTeam(name: string): Promise<AdminTeam> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/teams", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create team");
  return data as AdminTeam;
}

export async function adminUpdateTeam(
  id: string,
  input: { name?: string; active?: boolean }
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
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/directory");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load members directory");
  return data as DirectoryPerson[];
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

export async function loginSajiloKanun(
  username: string,
  password: string
): Promise<{ token: string; user: SajiloKanunUser }> {
  const res = await fetch("/api/sajilokanun-auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Login failed");
  }

  setSajiloKanunToken(data.token);
  return data as { token: string; user: SajiloKanunUser };
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
  const { authedFetch } = await import("@/lib/auth");
  const qs = options?.revealId
    ? `?reveal=${encodeURIComponent(options.revealId)}`
    : "";
  const res = await authedFetch(`/admin/gemini-keys${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load Gemini keys");
  return (data.keys ?? []) as GeminiApiKeyRecord[];
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

