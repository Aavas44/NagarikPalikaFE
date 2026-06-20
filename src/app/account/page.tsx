"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchCurrentUser, logout } from "@/lib/auth";
import pageStyles from "@/app/user.module.css";

export default function AccountPage() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        setUserName(user?.name ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className={pageStyles.calculatorPage}>
      <div className={pageStyles.calculatorPageInner}>
        <Link href="/" className={pageStyles.calculatorBack}>
          ← Back to home
        </Link>
        <h1>Your account</h1>
        {loading ? (
          <p className={pageStyles.calculatorSubtitle}>Loading…</p>
        ) : (
          <>
            <p className={pageStyles.calculatorSubtitle}>
              {userName ? `Signed in as ${userName}.` : "You are signed in."}
            </p>
            <button
              type="button"
              className={pageStyles.navCta}
              onClick={() => logout()}
              style={{ marginTop: "1rem" }}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </section>
  );
}
