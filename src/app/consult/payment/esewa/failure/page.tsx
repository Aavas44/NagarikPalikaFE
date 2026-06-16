import Link from "next/link";
import styles from "@/components/consult/consult.module.css";

export default function EsewaFailurePage() {
  return (
    <div className={styles.portalMain}>
      <div className={styles.portalCard}>
        <h1>Payment failed</h1>
        <p>Your eSewa payment was not completed. You can try again from your consultation request.</p>
        <Link href="/consult" className={styles.btnPrimary} style={{ display: "inline-block", marginTop: 12, textDecoration: "none" }}>
          Back to booking
        </Link>
      </div>
    </div>
  );
}
