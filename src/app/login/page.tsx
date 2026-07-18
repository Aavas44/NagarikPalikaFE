"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  citizenLogin,
  citizenRegister,
  login,
  setToken,
} from "@/lib/auth";
import { setSajiloKanunToken } from "@/lib/sajilokanun-access";
import styles from "./login.module.css";

type LoginMode = "citizen" | "admin";
type CitizenMode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent");
  const [mode, setMode] = useState<LoginMode>("citizen");
  const [citizenMode, setCitizenMode] = useState<CitizenMode>("signin");
  const [name, setName] = useState("");
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
    google_not_configured:
      "Google sign-in is not configured yet. Use email signup or contact an administrator.",
    use_admin_login: "Admin accounts must use email/password sign-in.",
    admin_only: "Admin access only.",
    citizen_only: "This sign-in option is not available yet.",
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

  async function handleCitizenSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result =
        citizenMode === "signup"
          ? await citizenRegister({ name, email, password })
          : await citizenLogin(email, password);
      setToken(result.token);
      setSajiloKanunToken(result.sajiloKanunToken);
      router.push("/sajilokanun/chat");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue");
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
            <h1>{citizenMode === "signup" ? "Create an account" : "Citizen sign in"}</h1>
            <p>
              Continue to Sajilo Kanun with one free legal research query every day.
            </p>

            <a href="/api/auth/google" className={styles.googleBtn}>
              <span>Continue with Google</span>
            </a>

            <div className={styles.divider}>or use email</div>

            <div className={styles.citizenModeTabs}>
              <button
                type="button"
                className={citizenMode === "signin" ? styles.tabActive : styles.tab}
                onClick={() => setCitizenMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                className={citizenMode === "signup" ? styles.tabActive : styles.tab}
                onClick={() => setCitizenMode("signup")}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleCitizenSubmit}>
              {citizenMode === "signup" ? (
                <div className={styles.formGroup}>
                  <label htmlFor="citizen-name">Full name</label>
                  <input
                    id="citizen-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              ) : null}
              <div className={styles.formGroup}>
                <label htmlFor="citizen-email">Email</label>
                <input
                  id="citizen-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="citizen-password">Password</label>
                <input
                  id="citizen-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    citizenMode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={8}
                  required
                />
              </div>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading
                  ? "Please wait…"
                  : citizenMode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>Admin sign in</h1>
            <p>Manage terminology, templates, and site content</p>

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
