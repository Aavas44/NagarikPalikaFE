import { cookies } from "next/headers";
import { createHash } from "node:crypto";

const SAJILO_KANUN_USER_TYPE = "sajilo_kanun";

export function isSajiloKanunToken(token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { userType?: string };
    return payload.userType === SAJILO_KANUN_USER_TYPE;
  } catch {
    return false;
  }
}

export async function getSajiloKanunTokenFromCookies(): Promise<string | null> {
  const store = await cookies();
  return store.get("sajilo_kanun_token")?.value ?? null;
}

export async function requireSajiloKanunAccess(): Promise<Response | null> {
  const token = await getSajiloKanunTokenFromCookies();
  return requireVerifiedSajiloKanunAccess(token);
}

export async function requireSajiloKanunAccessFromRequest(
  request: Request,
  options: { consumeQuery?: boolean; questionText?: string } = {}
): Promise<Response | null> {
  const token = getSajiloKanunTokenFromRequest(request);
  return requireVerifiedSajiloKanunAccess(token, {
    consumeQuery: options.consumeQuery,
    questionId: request.headers.get("x-sajilo-question-id"),
    questionHash: options.questionText
      ? createHash("sha256").update(options.questionText.trim()).digest("hex")
      : null,
  });
}

async function requireVerifiedSajiloKanunAccess(
  token: string | null,
  options: {
    consumeQuery?: boolean;
    questionId?: string | null;
    questionHash?: string | null;
  } = {}
): Promise<Response | null> {
  if (!isSajiloKanunToken(token)) {
    return Response.json(
      { error: "Sajilo Kanun access required. Please sign in at /sajilokanun." },
      { status: 401 }
    );
  }

  try {
    const apiBase = process.env.API_URL ?? "http://127.0.0.1:4000";
    const params = new URLSearchParams();
    if (options.consumeQuery) params.set("consume", "1");
    if (options.questionId) params.set("questionId", options.questionId);
    if (options.questionHash) params.set("questionHash", options.questionHash);
    const response = await fetch(
      `${apiBase}/api/sajilokanun-auth/authorize/chat?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (response.ok) return null;

    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return Response.json(
      { error: body?.error ?? "Sajilo Kanun access denied" },
      { status: response.status }
    );
  } catch {
    return Response.json(
      { error: "Unable to validate Sajilo Kanun access" },
      { status: 503 }
    );
  }
}

export function getSajiloKanunTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)sajilo_kanun_token=([^;]+)/);
  const cookieToken = match ? decodeURIComponent(match[1]) : null;

  const auth = request.headers.get("authorization");
  const bearerToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  return bearerToken ?? cookieToken;
}
