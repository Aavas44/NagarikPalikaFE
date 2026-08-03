import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

export const runtime = "nodejs";

function apiBaseUrl(): string {
  return (process.env.API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
}

function internalSecret(): string {
  return (
    process.env.INTERNAL_API_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "dev-cron-secret"
  );
}

/**
 * Prefer `x-nagarik-token` (Next may strip `Authorization` on some handlers),
 * then Authorization, then cookie.
 */
async function readAuthToken(request: Request): Promise<string | null> {
  const headerStore = await headers();
  const fromCustom =
    headerStore.get("x-nagarik-token") ||
    request.headers.get("x-nagarik-token");
  if (fromCustom?.trim()) return fromCustom.trim();

  const auth =
    headerStore.get("authorization") || request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  const cookieStore = await cookies();
  return cookieStore.get("nagarik_palika_token")?.value?.trim() || null;
}

/**
 * Superadmin helper: upsert GEMINI_API_KEY + GEMINI_API_KEY_FALLBACK from
 * frontend/.env.local into the Mongo key pool.
 *
 * Lives under /api/sajilokanun/* so Next handles it (/api/admin/* is rewritten
 * to Express).
 */
export async function POST(request: Request) {
  const token = await readAuthToken(request);

  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const meRes = await fetch(`${apiBaseUrl()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!meRes.ok) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
  const me = (await meRes.json()) as { user?: { userType?: string } };
  if (me.user?.userType !== "superadmin") {
    return NextResponse.json({ error: "Superadmin access required" }, { status: 403 });
  }

  const keys: Array<{
    label: string;
    apiKey: string;
    role: "default" | "fallback" | "pool";
  }> = [];
  const primary = process.env.GEMINI_API_KEY?.trim();
  const fallback = process.env.GEMINI_API_KEY_FALLBACK?.trim();
  if (primary) {
    keys.push({
      label: "GEMINI_API_KEY",
      apiKey: primary,
      role: "default",
    });
  }
  if (fallback) {
    keys.push({
      label: "GEMINI_API_KEY_FALLBACK",
      apiKey: fallback,
      role: primary ? "fallback" : "default",
    });
  }
  if (!keys.length) {
    return NextResponse.json(
      {
        error:
          "No GEMINI_API_KEY or GEMINI_API_KEY_FALLBACK found in frontend/.env.local",
      },
      { status: 400 }
    );
  }

  const res = await fetch(`${apiBaseUrl()}/api/admin/gemini-keys/import-env`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret(),
    },
    body: JSON.stringify({ keys }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? "Import failed" },
      { status: res.status }
    );
  }
  return NextResponse.json({
    ...data,
    source: {
      GEMINI_API_KEY: Boolean(primary),
      GEMINI_API_KEY_FALLBACK: Boolean(fallback),
    },
  });
}
