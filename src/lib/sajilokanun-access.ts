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

export type DirectoryUserType = "superadmin" | "admin" | "firm_admin" | "member";

export type RoleKey =
  | "platform.superadmin"
  | "platform.admin"
  | "sk.firm_admin"
  | "sk.member"
  | "sk.individual";

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
  role?: "admin" | "member" | null;
  userType?: string | null;
  directoryUserType?: DirectoryUserType;
  createdAt?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
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
