const TOKEN_KEY = "sajilo_kanun_token";
const TOKEN_COOKIE = "sajilo_kanun_token";
const TOKEN_MAX_AGE = 30 * 24 * 60 * 60;
const DEMO_SESSION_KEY = "sajilo_kanun_demo_session_id";
const DEMO_SUBMITTED_KEY = "sajilo_kanun_demo_submitted";

export interface SajiloKanunUser {
  id: string;
  username: string;
  name: string;
}

export function setSajiloKanunToken(token: string): void {
  document.cookie = `${TOKEN_COOKIE}=${token}; path=/; max-age=${TOKEN_MAX_AGE}; SameSite=Lax`;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSajiloKanunToken(): void {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  localStorage.removeItem(TOKEN_KEY);
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
