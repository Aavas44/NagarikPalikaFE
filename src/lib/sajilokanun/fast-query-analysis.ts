import type { QueryAnalysis } from "./query-analysis";
import { questionTopicPinToAnalysis } from "./question-topic-pins";
import {
  isCustodyPresentQuery,
  isJaheriRegistrationRefusalQuery,
  isFalseComplaintQuery,
  isKharejCourtFeeRefundQuery,
  isMarriageAgeQuery,
  isMilapatraCourtFeeQuery,
  isMurderQuery,
  isPratiuttarDeadlineQuery,
  isPratiuttarAfterTamelDeadlineQuery,
  isTheftQuery,
  queryHintToBookScope,
} from "./legal-retrieval-boost";
import type { BookScope } from "./lawbooks";

/** Regex/heuristic analysis — skips the analysis LLM call for known topic patterns. */
export function tryFastQueryAnalysis(
  question: string,
  bookScope: BookScope
): QueryAnalysis | null {
  const topicPin = questionTopicPinToAnalysis(question, bookScope);
  if (topicPin) return topicPin;

  const scope =
    bookScope !== "auto" ? bookScope : queryHintToBookScope(question);
  const base = {
    originalQuery: question,
    factsFromQuestion: [] as string[],
    titleSearchHints: [] as string[],
  };

  if (isMilapatraCourtFeeQuery(question)) {
    if (scope && scope !== "civil-procedure") return null;
    return {
      ...base,
      intent: "मिलापत्र गर्दा अदालती शुल्क फिर्ता",
      legalIssues: ["अदालती शुल्क", "मिलापत्र", "फिर्ता"],
      retrievalQueries: ["अदालती शुल्क फिर्ता", "मुद्दा मिलापत्र"],
      sectionHints: [
        { section: "82", act: "civil-procedure" },
        { section: "248", act: "civil-procedure" },
      ],
      chapterHints: [
        { chapter: "6", name: "अदालती शुल्क", act: "civil-procedure" },
      ],
      preferredAct: "civil-procedure",
    };
  }

  if (isKharejCourtFeeRefundQuery(question)) {
    if (scope && scope !== "civil-procedure") return null;
    return {
      ...base,
      intent: "खारेज भएमा अदालती शुल्क फिर्ता",
      legalIssues: ["अदालती शुल्क", "खारेज", "फिर्ता"],
      retrievalQueries: ["खारेज अदालती शुल्क फिर्ता", "दफा ८२ खारेज"],
      sectionHints: [{ section: "82", act: "civil-procedure" }],
      chapterHints: [
        { chapter: "6", name: "अदालती शुल्क", act: "civil-procedure" },
      ],
      preferredAct: "civil-procedure",
    };
  }

  if (isPratiuttarDeadlineQuery(question)) {
    if (scope && scope !== "civil-procedure") return null;
    if (isPratiuttarAfterTamelDeadlineQuery(question)) {
      return {
        ...base,
        intent: "प्रतिउत्तरपत्र पेश गर्ने म्याद (म्याद तामेल पछि)",
        legalIssues: ["प्रतिउत्तर", "म्याद", "थमाउ"],
        retrievalQueries: [
          "प्रतिउत्तरपत्र म्याद तामेल",
          "दफा ११९ एक्काइस दिन",
        ],
        sectionHints: [
          { section: "119", act: "civil-procedure" },
          { section: "163", act: "civil-procedure" },
          { section: "223", act: "civil-procedure" },
          { section: "225", act: "civil-procedure" },
        ],
        chapterHints: [
          { chapter: "9", name: "प्रतिउत्तर", act: "civil-procedure" },
        ],
        preferredAct: "civil-procedure",
      };
    }
    return {
      ...base,
      intent: "प्रतिउत्तरपत्र पेश गर्ने म्याद",
      legalIssues: ["प्रतिउत्तर", "म्याद", "थमाउ"],
      retrievalQueries: ["प्रतिउत्तरपत्र म्याद", "दफा १०१ एक्काइस दिन"],
      sectionHints: [
        { section: "100", act: "civil-procedure" },
        { section: "101", act: "civil-procedure" },
        { section: "163", act: "civil-procedure" },
        { section: "223", act: "civil-procedure" },
        { section: "225", act: "civil-procedure" },
      ],
      chapterHints: [
        { chapter: "9", name: "प्रतिउत्तर", act: "civil-procedure" },
        { chapter: "8", name: "म्याद", act: "civil-procedure" },
      ],
      preferredAct: "civil-procedure",
    };
  }

  if (isMurderQuery(question)) {
    if (scope && scope !== "criminal-code") return null;
    return {
      ...base,
      intent: "हत्याको सजाय",
      legalIssues: ["हत्या"],
      retrievalQueries: ["हत्या सजाय"],
      sectionHints: [{ section: "177", act: "criminal-code" }],
      chapterHints: [],
      preferredAct: "criminal-code",
    };
  }

  if (isTheftQuery(question)) {
    if (scope && scope !== "criminal-code") return null;
    return {
      ...base,
      intent: "चोरीको सजाय",
      legalIssues: ["चोरी"],
      retrievalQueries: ["चोरी सजाय"],
      sectionHints: [
        { section: "241", act: "criminal-code" },
        { section: "242", act: "criminal-code" },
      ],
      chapterHints: [],
      preferredAct: "criminal-code",
    };
  }

  if (isCustodyPresentQuery(question)) {
    if (scope && scope !== "criminal-procedure") return null;
    return {
      ...base,
      intent: "पक्राउ पर्ने अवधि",
      legalIssues: ["पक्राउ", "अनुसन्धान"],
      retrievalQueries: ["पक्राउ अवधि"],
      sectionHints: [{ section: "14", act: "criminal-procedure" }],
      chapterHints: [],
      preferredAct: "criminal-procedure",
    };
  }

  if (isJaheriRegistrationRefusalQuery(question)) {
    if (scope && scope !== "criminal-procedure") return null;
    return {
      ...base,
      intent: "जाहेरी दर्ता नमानमा उजुर गर्ने",
      legalIssues: ["जाहेरी", "दर्ता", "उजुरी"],
      retrievalQueries: ["जाहेरी दर्ता नमान", "दफा ५ उजुरी"],
      sectionHints: [{ section: "5", act: "criminal-procedure" }],
      chapterHints: [],
      preferredAct: "criminal-procedure",
    };
  }

  if (isFalseComplaintQuery(question)) {
    if (scope && scope !== "criminal-code") return null;
    return {
      ...base,
      intent: "झुठ्ठा उजुरी",
      legalIssues: ["झुठ्ठा उजुरी"],
      retrievalQueries: ["झुठ्ठा उजुरी"],
      sectionHints: [],
      chapterHints: [],
      preferredAct: "criminal-code",
      titleSearchHints: ["झुठ्ठा उजुरी दिन नहुने"],
    };
  }

  if (isMarriageAgeQuery(question)) {
    if (scope === "civil-procedure" || scope === "criminal-procedure") return null;
    const sectionHints =
      scope === "criminal-code"
        ? [{ section: "173", act: "criminal-code" as const }]
        : scope === "civil-code"
          ? [{ section: "70", act: "civil-code" as const }]
          : [
              { section: "70", act: "civil-code" as const },
              { section: "173", act: "criminal-code" as const },
            ];
    return {
      ...base,
      intent: "विवाह योग्य उमेर",
      legalIssues: ["विवाह उमेर", "बालविवाह"],
      retrievalQueries: ["विवाह उमेर", "बाल विवाह"],
      sectionHints,
      chapterHints: [],
      preferredAct:
        scope === "criminal-code" ? "criminal-code" : "civil-code",
    };
  }

  return null;
}
