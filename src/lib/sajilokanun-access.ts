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
  role?: "admin" | "member" | null;
  teamName?: string | null;
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

export function getSkRoleFromToken(): "admin" | "member" | null {
  const token = getSajiloKanunToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { role?: string };
    if (payload.role === "admin" || payload.role === "member") return payload.role;
    return null;
  } catch {
    return null;
  }
}

export interface TeamMember {
  id: string;
  username: string;
  name: string;
  email: string;
  active: boolean;
  role: "admin" | "member" | null;
}

export interface LegalCaseRecord {
  id: string;
  teamId: string;
  title: string;
  caseNo: string;
  type: "civil" | "criminal" | "other";
  status: "open" | "pending" | "closed";
  notes: string;
  assignedMemberIds: string[];
  createdBy: string;
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

export async function fetchCases(): Promise<LegalCaseRecord[]> {
  const res = await skAuthedFetch("/api/sajilokanun-auth/cases");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load cases");
  return data as LegalCaseRecord[];
}

export async function createCase(input: {
  title: string;
  caseNo: string;
  type: LegalCaseRecord["type"];
  status?: LegalCaseRecord["status"];
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

export async function adminFetchTeams(): Promise<AdminTeam[]> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/teams");
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

export async function adminCreateTeamAccount(
  teamId: string,
  input: {
    username: string;
    password: string;
    name: string;
    email?: string;
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
  input: { active?: boolean; role?: "admin" | "member"; password?: string }
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
