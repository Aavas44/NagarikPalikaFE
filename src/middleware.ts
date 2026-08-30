import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "nagarik_palika_token";
const SAJILO_KANUN_TOKEN_COOKIE = "sajilo_kanun_token";

function getSkTokenPayload(token: string): { userType?: string; role?: string } | null {
  try {
    return JSON.parse(atob(token.split(".")[1] ?? "")) as {
      userType?: string;
      role?: string;
    };
  } catch {
    return null;
  }
}

function getUserType(token: string): string | null {
  const payload = getSkTokenPayload(token);
  return payload?.userType ?? payload?.role ?? null;
}

function clearTokenCookie(response: NextResponse): NextResponse {
  response.cookies.set(TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

function redirectForUserType(userType: string, request: NextRequest): NextResponse {
  if (userType === "admin" || userType === "superadmin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (userType === "advocate") return NextResponse.redirect(new URL("/advocate", request.url));
  if (userType === "wardOperator") return NextResponse.redirect(new URL("/ward", request.url));
  if (userType === "user") return NextResponse.redirect(new URL("/account", request.url));
  const res = NextResponse.redirect(new URL("/sajilokanun/login", request.url));
  return clearTokenCookie(res);
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const { pathname } = request.nextUrl;
  const userType = token ? getUserType(token) : null;

  if (pathname.startsWith("/admin")) {
    if (!token || !userType) {
      const res = NextResponse.redirect(new URL("/sajilokanun/login", request.url));
      return token && !userType ? clearTokenCookie(res) : res;
    }
    if (userType !== "admin" && userType !== "superadmin") {
      return NextResponse.redirect(new URL("/sajilokanun/login?error=admin_only", request.url));
    }
  }

  if (pathname.startsWith("/consult")) {
    const loginUrl = new URL("/sajilokanun/login?intent=user", request.url);
    if (!token) return NextResponse.redirect(loginUrl);
    if (!userType) {
      const res = NextResponse.redirect(loginUrl);
      return clearTokenCookie(res);
    }
    if (userType !== "user") {
      loginUrl.searchParams.set("error", "citizen_only");
      const res = NextResponse.redirect(loginUrl);
      return clearTokenCookie(res);
    }
  }

  if (pathname.startsWith("/account")) {
    if (!token) return NextResponse.redirect(new URL("/sajilokanun/login?intent=user", request.url));
    if (!userType) {
      const res = NextResponse.redirect(new URL("/sajilokanun/login?intent=user", request.url));
      return clearTokenCookie(res);
    }
    if (userType !== "user") {
      const loginUrl = new URL("/sajilokanun/login?intent=user", request.url);
      loginUrl.searchParams.set("error", "citizen_only");
      const res = NextResponse.redirect(loginUrl);
      return clearTokenCookie(res);
    }
  }

  if (pathname.startsWith("/advocate")) {
    const isPublicAdvocate =
      pathname === "/advocate/login" || pathname === "/advocate/signup";
    if (isPublicAdvocate) {
      if (token && userType === "advocate") {
        return NextResponse.redirect(new URL("/advocate", request.url));
      }
      return NextResponse.next();
    }

    if (!token) return NextResponse.redirect(new URL("/advocate/login", request.url));
    if (!userType) {
      const res = NextResponse.redirect(new URL("/advocate/login", request.url));
      return clearTokenCookie(res);
    }
    if (userType !== "advocate") {
      return redirectForUserType(userType, request);
    }
  }

  if (pathname === "/ward/login") {
    return NextResponse.redirect(new URL("/sajilokanun/login", request.url));
  }

  if (pathname.startsWith("/ward")) {
    if (!token) return NextResponse.redirect(new URL("/sajilokanun/login", request.url));
    if (!userType) {
      const res = NextResponse.redirect(new URL("/sajilokanun/login", request.url));
      return clearTokenCookie(res);
    }
    if (userType !== "wardOperator") {
      return redirectForUserType(userType, request);
    }
  }

  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/sajilokanun/login";
    return NextResponse.redirect(url);
  }

  if (pathname === "/sajilokanun/login" && token) {
    const intent = request.nextUrl.searchParams.get("intent");
    if (intent === "user" && userType && userType !== "user") {
      return clearTokenCookie(NextResponse.next());
    }
    if (intent === "advocate") {
      return NextResponse.redirect(new URL("/advocate/login", request.url));
    }
    if (!userType) {
      return clearTokenCookie(NextResponse.next());
    }
    if (userType === "admin" || userType === "superadmin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (userType === "advocate") {
      return NextResponse.redirect(new URL("/advocate", request.url));
    }
    if (userType === "wardOperator") {
      return NextResponse.redirect(new URL("/ward", request.url));
    }
  }

  const isProtectedSajiloKanun =
    pathname.startsWith("/sajilokanun/dashboard") ||
    pathname.startsWith("/sajilokanun/chat") ||
    pathname.startsWith("/sajilokanun/unicode-converter") ||
    pathname.startsWith("/sajilokanun/usage") ||
    pathname.startsWith("/sajilokanun/team") ||
    pathname.startsWith("/sajilokanun/cases");

  if (isProtectedSajiloKanun) {
    const skToken = request.cookies.get(SAJILO_KANUN_TOKEN_COOKIE)?.value;
    if (!skToken || getUserType(skToken) !== "sajilo_kanun") {
      return NextResponse.redirect(new URL("/sajilokanun/login", request.url));
    }
    const skPayload = getSkTokenPayload(skToken);
    const isCaseUser = skPayload?.role === "caseUser";
    const blockedForCaseUser =
      pathname.startsWith("/sajilokanun/dashboard") ||
      pathname.startsWith("/sajilokanun/chat") ||
      pathname.startsWith("/sajilokanun/unicode-converter") ||
      pathname.startsWith("/sajilokanun/usage") ||
      pathname.startsWith("/sajilokanun/team");
    if (isCaseUser && blockedForCaseUser) {
      return NextResponse.redirect(new URL("/sajilokanun/cases", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/login",
    "/sajilokanun/login",
    "/account/:path*",
    "/consult/:path*",
    "/advocate/:path*",
    "/ward",
    "/ward/:path*",
    "/sajilokanun/dashboard",
    "/sajilokanun/dashboard/:path*",
    "/sajilokanun/chat",
    "/sajilokanun/chat/:path*",
    "/sajilokanun/unicode-converter",
    "/sajilokanun/unicode-converter/:path*",
    "/sajilokanun/usage",
    "/sajilokanun/usage/:path*",
    "/sajilokanun/team",
    "/sajilokanun/team/:path*",
    "/sajilokanun/cases",
    "/sajilokanun/cases/:path*",
  ],
};
