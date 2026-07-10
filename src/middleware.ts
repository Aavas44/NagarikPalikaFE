import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "nagarik_palika_token";
const SAJILO_KANUN_TOKEN_COOKIE = "sajilo_kanun_token";

function getUserType(token: string): string | null {
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

function clearTokenCookie(response: NextResponse): NextResponse {
  response.cookies.set(TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

function redirectForUserType(userType: string, request: NextRequest): NextResponse {
  if (userType === "admin") return NextResponse.redirect(new URL("/admin", request.url));
  if (userType === "advocate") return NextResponse.redirect(new URL("/advocate", request.url));
  if (userType === "user") return NextResponse.redirect(new URL("/account", request.url));
  const res = NextResponse.redirect(new URL("/login", request.url));
  return clearTokenCookie(res);
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const { pathname } = request.nextUrl;
  const userType = token ? getUserType(token) : null;

  if (pathname.startsWith("/admin")) {
    if (!token || !userType) {
      const res = NextResponse.redirect(new URL("/login", request.url));
      return token && !userType ? clearTokenCookie(res) : res;
    }
    if (userType !== "admin") {
      return NextResponse.redirect(new URL("/login?error=admin_only", request.url));
    }
  }

  if (pathname.startsWith("/consult")) {
    const loginUrl = new URL("/login?intent=user", request.url);
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
    if (!token) return NextResponse.redirect(new URL("/login?intent=user", request.url));
    if (!userType) {
      const res = NextResponse.redirect(new URL("/login?intent=user", request.url));
      return clearTokenCookie(res);
    }
    if (userType !== "user") {
      const loginUrl = new URL("/login?intent=user", request.url);
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

  if (pathname === "/login" && token) {
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
    return redirectForUserType(userType, request);
  }

  const isProtectedSajiloKanun =
    pathname.startsWith("/sajilokanun/chat") ||
    pathname.startsWith("/sajilokanun/unicode-converter");

  if (isProtectedSajiloKanun) {
    const skToken = request.cookies.get(SAJILO_KANUN_TOKEN_COOKIE)?.value;
    if (!skToken || getUserType(skToken) !== "sajilo_kanun") {
      return NextResponse.redirect(new URL("/sajilokanun", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/login",
    "/account/:path*",
    "/consult/:path*",
    "/advocate/:path*",
    "/sajilokanun/chat",
    "/sajilokanun/chat/:path*",
    "/sajilokanun/unicode-converter",
    "/sajilokanun/unicode-converter/:path*",
  ],
};
