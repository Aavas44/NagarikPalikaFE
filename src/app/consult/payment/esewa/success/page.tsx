"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEsewaPayment } from "@/lib/consult";
import styles from "@/components/consult/consult.module.css";

export default function EsewaSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const paymentId = searchParams.get("pid") ?? searchParams.get("paymentId");
    const refId = searchParams.get("refId") ?? searchParams.get("oid");
    const amt = searchParams.get("amt") ?? searchParams.get("tAmt") ?? "1000";

    if (!paymentId || !refId) {
      setError("Missing payment parameters");
      return;
    }

    verifyEsewaPayment(paymentId, refId, amt)
      .then(() => router.replace("/account"))
      .catch((err) => setError(err instanceof Error ? err.message : "Verification failed"));
  }, [router, searchParams]);

  return (
    <div className={styles.portalMain}>
      <div className={styles.portalCard}>
        <h1>Processing eSewa payment…</h1>
        {error ? (
          <>
            <div className={styles.error}>{error}</div>
            <Link href="/account">Go to my requests</Link>
          </>
        ) : (
          <p>Please wait while we confirm your payment.</p>
        )}
      </div>
    </div>
  );
}
