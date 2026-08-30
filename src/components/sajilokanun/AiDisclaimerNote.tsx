"use client";

import Link from "next/link";
import styles from "./AiDisclaimerNote.module.css";

export function AiDisclaimerNote({
  text,
  termsHref = "/terms",
  termsLabel,
}: {
  text: string;
  termsHref?: string;
  termsLabel: string;
}) {
  return (
    <p className={styles.note} role="note">
      {text}{" "}
      <Link href={termsHref} className={styles.link}>
        {termsLabel}
      </Link>
    </p>
  );
}
