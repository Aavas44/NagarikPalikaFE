"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/auth";
import { setSajiloKanunToken } from "@/lib/sajilokanun-access";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const sajiloToken = searchParams.get("sajiloToken");
    const redirect = searchParams.get("redirect") ?? "/account";

    if (token && sajiloToken) {
      setToken(token);
      setSajiloKanunToken(sajiloToken);
      router.replace(redirect);
    } else {
      router.replace("/login?error=oauth_failed");
    }
  }, [router, searchParams]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <p>Signing you in…</p>
    </div>
  );
}
