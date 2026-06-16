"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { advocateLogin, setToken } from "@/lib/auth";
import styles from "@/components/consult/consult.module.css";
import loginStyles from "@/app/login/login.module.css";

export default function AdvocateLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(searchParams.get("error") ?? "");
  const [loading, setLoading] = useState(false);

  const errorMessages: Record<string, string> = {
    use_advocate_login: "Advocate accounts use email and password — not Google.",
  };

  const displayError = errorMessages[error] ?? (error || "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { token } = await advocateLogin(email, password);
      setToken(token);
      router.push("/advocate");
      router.refresh();
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.portal}>
      <header className={styles.portalHeader}>
        <Link href="/">Nagarik Palika</Link>
      </header>

      <main className={styles.portalMain}>
        <div className={`${styles.portalCard} ${loginStyles.card}`} style={{ maxWidth: 420, margin: "0 auto" }}>
          <h1>Advocate sign in</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: "1rem" }}>
            Sign in with the email you used to register your practice.
          </p>

          {displayError && <div className={styles.error}>{displayError}</div>}

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p style={{ fontSize: 13, marginTop: "1.25rem", color: "#6b7280" }}>
            New advocate? <Link href="/advocate/signup">Register your practice</Link>
          </p>
          <p style={{ fontSize: 13, marginTop: "0.5rem" }}>
            <Link href="/login?intent=user">← Citizen sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
