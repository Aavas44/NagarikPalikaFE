"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import styles from "@/app/user.module.css";

export function FaqSection() {
  const { msg } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <>
      <div className={styles.divider} />
      <div className={styles.section} id="faq">
        <div className={styles.sectionHeader}>
          <h2>{msg.sections.faq}</h2>
        </div>
        <div className={styles.faqList}>
          {msg.faqItems.map((item, i) => (
            <div key={i} className={styles.faqItem}>
              <button
                type="button"
                className={styles.faqQuestion}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
              >
                {item.q}
                <span className={styles.faqToggle}>{openIndex === i ? "−" : "+"}</span>
              </button>
              {openIndex === i && <p className={styles.faqAnswer}>{item.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
