import { cookies } from "next/headers";

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
  if (!isSajiloKanunToken(token)) {
    return Response.json(
      { error: "Sajilo Kanun access required. Please sign in at /sajilokanun." },
      { status: 401 }
    );
  }
  return null;
}

export function requireSajiloKanunAccessFromRequest(request: Request): Response | null {
  const token = getSajiloKanunTokenFromRequest(request);
  if (!isSajiloKanunToken(token)) {
    return Response.json(
      { error: "Sajilo Kanun access required. Please sign in at /sajilokanun." },
      { status: 401 }
    );
  }
  return null;
}

export function getSajiloKanunTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)sajilo_kanun_token=([^;]+)/);
  const cookieToken = match ? decodeURIComponent(match[1]) : null;

  const auth = request.headers.get("authorization");
  const bearerToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  return bearerToken ?? cookieToken;
}
