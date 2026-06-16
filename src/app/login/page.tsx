"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, setToken } from "@/lib/auth";
import styles from "./login.module.css";

type LoginMode = "citizen" | "admin";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent");
  const [mode, setMode] = useState<LoginMode>("citizen");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(searchParams.get("error") ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (intent === "user") setMode("citizen");
  }, [intent]);

  const errorMessages: Record<string, string> = {
    oauth_cancelled: "Google sign-in was cancelled.",
    oauth_failed: "Google sign-in failed. Please try again.",
    use_admin_login: "Admin accounts must use email/password sign-in.",
    admin_only: "Admin access only.",
    citizen_only:
      "Booking a consultation requires a citizen account. Sign in with Google below.",
  };

  const displayError = errorMessages[error] ?? (error || "");

  async function handleAdminSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { token } = await login(email, password);
      setToken(token);
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.card}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>🏛</span>
          Nagarik Palika
        </Link>

        <div className={styles.tabs}>
          <button
            type="button"
            className={mode === "citizen" ? styles.tabActive : styles.tab}
            onClick={() => setMode("citizen")}
          >
            Citizen
          </button>
          <button
            type="button"
            className={mode === "admin" ? styles.tabActive : styles.tab}
            onClick={() => setMode("admin")}
          >
            Admin
          </button>
        </div>

        {displayError && <div className={styles.error}>{displayError}</div>}

        {mode === "citizen" ? (
          <>
            <h1>Citizen sign in</h1>
            <p>Book legal consultations with verified advocates</p>

            <a href="/api/auth/google" className={styles.googleBtn}>
              <span>Continue with Google</span>
            </a>

            <p className={styles.hint}>
              Are you an advocate?{" "}
              <Link href="/advocate/signup">Create an account</Link> or{" "}
              <Link href="/advocate/login">sign in</Link>.
            </p>
          </>
        ) : (
          <>
            <h1>Admin sign in</h1>
            <p>Manage content, advocates, and consultations</p>

            <form onSubmit={handleAdminSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nagarikpalika.gov.np"
                  required
                  autoComplete="email"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </>
        )}

        <Link href="/" className={styles.backLink}>
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
