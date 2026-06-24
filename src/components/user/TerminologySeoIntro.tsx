import styles from "./emi.module.css";

/** Server-rendered bilingual intro for crawlers and first paint. */
export function TerminologySeoIntro() {
  return (
    <section className={styles.bilingualSeoIntroWrap} aria-label="Language availability">
      <div className={styles.bilingualSeoIntro}>
        <p className={styles.bilingualBadge}>
          <span lang="ne">अंग्रेजी र नेपालीमा</span>
          <span className={styles.bilingualBadgeSep} aria-hidden>
            ·
          </span>
          <span lang="en">English &amp; Nepali</span>
        </p>
        <p className={styles.bilingualSeoText} lang="ne">
          कानूनी शब्दकोश (Kanuni Shabdakosh) र सरल सेवा शब्दकोशबाट सिफारिस, लालपुर्जा, मालपोत,
          नागरिकता जस्ता सरकारी शब्द देवनागरी, रोमन लिप्यन्तरण वा अंग्रेजीमा खोज्नुहोस्।
        </p>
        <p className={styles.bilingualSeoText} lang="en">
          Search 6,400+ Nepal government and legal terms — Sifaris, Lalpurja, Malpot, citizenship —
          in Devanagari, Roman transliteration, and English.
        </p>
      </div>
    </section>
  );
}
