import type { AuthUser, LoginResponse } from "@/types";

const TOKEN_KEY = "nagarik_palika_token";
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

export function setToken(token: string): void {
  document.cookie = `nagarik_palika_token=${token}; path=/; max-age=${TOKEN_MAX_AGE}; SameSite=Lax`;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  document.cookie = "nagarik_palika_token=; path=/; max-age=0; SameSite=Lax";
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUserTypeFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as {
      userType?: string;
      role?: string;
    };
    return payload.userType ?? payload.role ?? null;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Login failed");
  }

  return data as LoginResponse;
}

export async function advocateLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch("/api/auth/advocate/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Login failed");
  }

  return data as LoginResponse;
}

export async function advocateRegister(body: Record<string, unknown>): Promise<LoginResponse> {
  const res = await fetch("/api/auth/advocate/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Registration failed");
  }

  return data as LoginResponse;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;

  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    clearToken();
    return null;
  }

  const data = await res.json();
  return data.user as AuthUser;
}

export function logout(redirectTo = "/login"): void {
  clearToken();
  window.location.href = redirectTo;
}

export async function authedFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}
