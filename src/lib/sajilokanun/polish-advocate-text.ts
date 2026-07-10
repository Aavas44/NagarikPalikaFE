/** Fix common LLM glitches in advocate **सारांश** (Roman leaks, glued दफा, typos). */
export function polishAdvocateNepaliText(text: string): string {
  let out = text;

  out = out.replace(
    /milapa[^\s\u0900-\u097F]*साक्षी/giu,
    "प्रमाण बुझाइपछि"
  );
  out = out.replace(/milapatra|milapaत्र|milapaत्र/giu, "मिलापत्र");
  out = out.replace(/([a-zA-Z]{2,})/g, (match) => {
    const lower = match.toLowerCase();
    if (lower === "milapatra" || lower.startsWith("milapa")) return "मिलापत्र";
    return match;
  });

  out = out.replace(/दफा([०-९])/g, "दफा $1");
  out = out.replace(/([०-९])उप\s*दफा/g, " दफा $1 को उपदफा");
  out = out.replace(/([^\s])दफा/g, "$1 दफा");
  out = out.replace(/उप\s+दफा/g, "उपदफा");
  out = out.replace(/([^\s])([०-९]{1,3})प्रतिशत/g, "$1 $2 प्रतिशत");
  out = out.replace(/को([०-९])/g, "को $1");

  out = out.replace(/भएमाया/g, "भएमा वा");
  out = out.replace(/गरिएकोछ/g, "गरिएको छ");
  out = out.replace(/हुनेछैन/g, "हुने छैन");
  out = out.replace(/हुनेछ/g, "हुने छ");

  out = out.replace(/पनिएक\s*वर्ष/g, "पर्ने एक वर्ष");
  out = out.replace(/पनिएक/g, "पर्ने");
  out = out.replace(/अधिकारछ/g, "अधिकार छ");
  out = out.replace(/हो\s*भने/g, "हो भने");
  out = out.replace(/हुँदैछ/g, "हुन्छ");

  return out;
}

/** Polish only the **सारांश** section; leave मुद्दा and लागू प्रावधानहरू untouched. */
export function polishAdvocateAnswerSections(text: string): string {
  const marker = "**सारांश**";
  const idx = text.indexOf(marker);
  if (idx < 0) return polishAdvocateNepaliText(text);

  const head = text.slice(0, idx + marker.length);
  const tail = polishAdvocateNepaliText(text.slice(idx + marker.length));
  return head + tail;
}
