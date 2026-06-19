"use client";

import styles from "./gharBatoSifaris.module.css";

function Blank({
  className,
  width,
  placeholder,
}: {
  className?: string;
  width?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      className={`${styles.blank} ${width ? styles[`blank${width.charAt(0).toUpperCase()}${width.slice(1)}`] : ""} ${className ?? ""}`}
      placeholder={placeholder}
      aria-label={placeholder ?? "खाली ठाउँ"}
    />
  );
}

function BlankArea({ rows = 2 }: { rows?: number }) {
  return (
    <textarea
      className={styles.blankArea}
      rows={rows}
      aria-label="खाली ठाउँ"
    />
  );
}

export function GharBatoSifarisForm() {
  return (
    <article className={styles.document} lang="ne">
      <header className={styles.letterhead}>
        <div className={styles.letterheadEmblem} aria-hidden>
          🇳🇵
        </div>
        <div className={styles.letterheadCenter}>
          <h2 className={styles.municipality}>
            <Blank width="lg" placeholder="नगरपालिका / गाउँपालिकाको नाम" />
          </h2>
          <p className={styles.wardOffice}>
            <Blank width="sm" placeholder="वडा नं." /> नं. वडा कार्यालय
          </p>
          <p className={styles.addressLine}>
            <Blank width="md" placeholder="ठेगाना" />
          </p>
          <p className={styles.addressLine}>
            <Blank width="sm" placeholder="प्रदेश" />, नेपाल।
          </p>
        </div>
        <div className={styles.letterheadSeal} aria-hidden>
          ✦
        </div>
      </header>

      <div className={styles.refRow}>
        <div className={styles.refCol}>
          <p>
            चलानी नं.: <Blank width="sm" />
          </p>
          <p>
            पत्र संख्या: <Blank width="sm" />
          </p>
        </div>
        <div className={`${styles.refCol} ${styles.refColRight}`}>
          <p>
            फोन नं. <Blank width="sm" />
          </p>
          <p>
            मिति : <Blank width="sm" placeholder="गते महिना वर्ष" />
          </p>
          <p>
            ने.सं. : <Blank width="sm" />
          </p>
        </div>
      </div>

      <p className={styles.recipient}>
        श्री <Blank width="lg" placeholder="कार्यालयको नाम" /> कार्यालय,{" "}
        <Blank width="md" placeholder="ठेगाना" /> ।
      </p>

      <p className={styles.subject}>
        <strong>विषय</strong> : घर/बाटो प्रमाणित बारे ।
      </p>

      <p className={styles.bodyText}>
        उपरोक्त विषयका सम्बन्धमा देहायको मालपोत कार्यालयमा रजिष्ट्रेशन प्रयोजनको
        लागि नापी नक्सा फिल्डअनुसार घर बाटो भए नभएको सम्बन्धमा द.नं.{" "}
        <Blank width="sm" placeholder="दर्ता नं." /> को निवेदकबाट माग
        गरेअनुसार निम्न कित्ताहरूको घर बाटो सम्बन्धी विवरण खुलाई प्रमाणित गरी
        पठाईएको व्यहोरा अनुरोध गरिन्छ ।
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>जग्गाधनीको नाम लिने/दिने</th>
              <th>न.पा./गा.पा.</th>
              <th>वडा नं.</th>
              <th>कि.नं.</th>
              <th>क्षेत्रफल</th>
              <th>घर बाटोको विवरण</th>
              <th>कैफियत</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className={styles.partyLabel}>दिने :</span>
                <Blank width="full" placeholder="जग्गाधनीको नाम" />
              </td>
              <td rowSpan={2}>
                <Blank width="full" placeholder="न.पा./गा.पा." />
              </td>
              <td rowSpan={2}>
                <Blank width="full" placeholder="वडा नं." />
              </td>
              <td rowSpan={2}>
                <Blank width="full" placeholder="कि.नं." />
              </td>
              <td rowSpan={2}>
                <Blank width="full" placeholder="रोपनी-आना-पैसा-दाम" />
              </td>
              <td rowSpan={2}>
                <BlankArea rows={3} />
              </td>
              <td rowSpan={2}>
                <BlankArea rows={3} />
              </td>
            </tr>
            <tr>
              <td>
                <span className={styles.partyLabel}>लिने :</span>
                <Blank width="full" placeholder="जग्गाधनीको नाम" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer className={styles.signatureBlock}>
        <div className={styles.signatureLine}>
          <Blank width="md" placeholder="हस्ताक्षर" />
        </div>
        <p className={styles.signatureHint}>वडा अध्यक्ष / वडा सदस्य</p>
        <p className={styles.stampHint}>(कार्यालयको छाप)</p>
      </footer>
    </article>
  );
}
