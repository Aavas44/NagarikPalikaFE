"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyKhaltiPayment } from "@/lib/consult";
import styles from "@/components/consult/consult.module.css";

export default function KhaltiVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const paymentId = searchParams.get("paymentId");
    const token = searchParams.get("token") ?? searchParams.get("pidx") ?? "";

    if (!paymentId) {
      setError("Missing payment ID");
      return;
    }

    verifyKhaltiPayment(paymentId, token)
      .then(() => router.replace("/account"))
      .catch((err) => setError(err instanceof Error ? err.message : "Verification failed"));
  }, [router, searchParams]);

  return (
    <div className={styles.portalMain}>
      <div className={styles.portalCard}>
        <h1>Verifying Khalti payment…</h1>
        {error ? (
          <>
            <div className={styles.error}>{error}</div>
            <Link href="/account">Go to my requests</Link>
          </>
        ) : (
          <p>Please wait.</p>
        )}
      </div>
    </div>
  );
}
