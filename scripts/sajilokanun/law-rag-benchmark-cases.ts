/**
 * 50-question Law RAG benchmark across indexed lawComission books.
 * Categories: title-quote, section-number, hierarchical, english, cross-document,
 * scenario, negative, roman-mixed, factual.
 */

export type BenchmarkCategory =
  | "title-quote"
  | "section-number"
  | "hierarchical"
  | "english"
  | "cross-document"
  | "scenario"
  | "negative"
  | "roman-mixed"
  | "factual";

export type AnswerMode = "quote" | "advocate";

export type BenchmarkExpect = {
  chatMode?: "verbatim" | "advocate";
  retrievalMode?: "keyword" | "vector";
  /** Substring all sources must include, or regex tested on filename */
  sourceBook?: string | RegExp;
  mustMatch?: RegExp[];
  mustNotMatch?: RegExp[];
  minSources?: number;
};

export type BenchmarkCase = {
  id: string;
  category: BenchmarkCategory;
  message: string;
  book: string;
  answerMode: AnswerMode;
  description: string;
  expect: BenchmarkExpect;
  /** Hint for fixes backlog when this case fails */
  fixArea?: "retrieval" | "indexing" | "formatting" | "llm" | "query-routing" | "negative-handling";
  fixHint?: string;
};

function criminalSource(): BenchmarkExpect {
  return { sourceBook: "अपराध संहिता" };
}

function civilSource(): BenchmarkExpect {
  return { sourceBook: "देवानी संहिता" };
}

function civilProcSource(): BenchmarkExpect {
  return { sourceBook: "देवानी कार्यविधि" };
}

function criminalProcSource(): BenchmarkExpect {
  return { sourceBook: "फौजदारी कार्यविधि" };
}

export const BENCHMARK_CASES: BenchmarkCase[] = [
  // ── title-quote (10) ──────────────────────────────────────────────
  {
    id: "tq-bal-vivah",
    category: "title-quote",
    message: "बाल विवाह",
    book: "auto",
    answerMode: "quote",
    description: "Short title → अपराध संहिता दफा १७३",
    fixArea: "retrieval",
    fixHint: "Expand title + filter homonym दफा १७३ across books",
    expect: {
      chatMode: "verbatim",
      retrievalMode: "keyword",
      sourceBook: "अपराध संहिता",
      minSources: 2,
      mustMatch: [/दफा\s*:\s*१७३/, /बाल विवाह गर्न नहुने/, /बीस वर्ष नपुगी/],
      mustNotMatch: [/धर्मपुत्र/, /सद्दे, कीर्ते/],
    },
  },
  {
    id: "tq-rastrapati-akraman",
    category: "title-quote",
    message: "राष्ट्रपति उपर आक्रमण",
    book: "criminal-code",
    answerMode: "quote",
    description: "दफा ५७ full hierarchical quote",
    expect: {
      chatMode: "verbatim",
      sourceBook: "अपराध संहिता",
      minSources: 2,
      mustMatch: [/दफा\s*:\s*५७/, /राज्य विरुद्धका कसूर/, /\(क\)/, /\(ख\)/, /\(ग\)/],
      mustNotMatch: [/संसदलाई/],
    },
  },
  {
    id: "tq-jhuttha-ujuri",
    category: "title-quote",
    message: "झुठ्ठा उजुरी दिन नहुने",
    book: "criminal-code",
    answerMode: "quote",
    description: "दफा ९८ with तर exception ordering",
    expect: {
      chatMode: "verbatim",
      sourceBook: "अपराध संहिता",
      minSources: 3,
      mustMatch: [/दफा\s*:\s*९८/, /तर नेपाल सरकारवादी/],
      mustNotMatch: [/बदनियतपूर्वक अनुसन्धान/],
    },
  },
  {
    id: "tq-vivah-hun-sakne",
    category: "title-quote",
    message: "विवाह हुन सक्ने",
    book: "civil-code",
    answerMode: "quote",
    description: "देवानी संहिता दफा ७० — बीस वर्ष",
    fixArea: "retrieval",
    fixHint: "Title pin to civil-code; include खण्ड (घ)",
    expect: {
      chatMode: "verbatim",
      sourceBook: "देवानी संहिता",
      mustMatch: [/दफा\s*:\s*७०/, /बीस वर्ष/],
      mustNotMatch: [/कार्यविधि/, /अपराध/],
    },
  },
  {
    id: "tq-karar-manyata",
    category: "title-quote",
    message: "कानून बमोजिम कार्यान्वयन हुने करार",
    book: "civil-code",
    answerMode: "quote",
    description: "दफा ५०५ — four validity conditions",
    expect: {
      chatMode: "verbatim",
      ...civilSource(),
      mustMatch: [/दफा\s*:\s*५०५/, /सहमति/, /सक्षमता/, /निश्चित विषय/, /कानूनसम्मत दायित्व/],
    },
  },
  {
    id: "tq-badar-karar",
    category: "title-quote",
    message: "बदर हुने करार",
    book: "civil-code",
    answerMode: "quote",
    description: "दफा ५१७ — void contract list (क)–(ठ)",
    fixArea: "formatting",
    fixHint: "restructure517VoidContractClauses; fix indexing metadata",
    expect: {
      chatMode: "verbatim",
      ...civilSource(),
      mustMatch: [
        /दफा\s*:\s*५१७/,
        /देहाय बमोजिमका करार बदर/,
        /कानूनको विरुद्धमा/,
        /अनैतिक उद्देश्य/,
      ],
    },
  },
  {
    id: "tq-faujdar-siddhant",
    category: "title-quote",
    message: "फौजदारी न्यायका सामान्य सिद्धान्तहरु",
    book: "criminal-code",
    answerMode: "quote",
    description: "Chapter title → multiple दफा under परिच्छेद २",
    expect: {
      chatMode: "verbatim",
      ...criminalSource(),
      minSources: 6,
      mustMatch: [/फौजदारी न्यायका सामान्य सिद्धान्तहरु/],
    },
  },
  {
    id: "tq-bhalai-manjuri",
    category: "title-quote",
    message: "भलाईका लागि मञ्जुरी लिई गरेको काम कसूर नहुने",
    book: "criminal-code",
    answerMode: "quote",
    description: "दफा १६",
    expect: {
      chatMode: "verbatim",
      ...criminalSource(),
      mustMatch: [/दफा\s*:\s*१६/],
    },
  },
  {
    id: "tq-myad-dinu",
    category: "title-quote",
    message: "म्याद दिनु पर्ने",
    book: "civil-procedure",
    answerMode: "quote",
    description: "देवानी कार्यविधि दफा १०१ — प्रतिउत्तर म्याद",
    fixArea: "retrieval",
    fixHint: "Disambiguate from criminal-procedure homonyms",
    expect: {
      chatMode: "verbatim",
      ...civilProcSource(),
      mustMatch: [/दफा\s*:\s*१०१/, /एक्का[इी]स दिन/],
    },
  },
  {
    id: "tq-jaheri-darkhast",
    category: "title-quote",
    message: "कसूरको जाहेरी दरखास्त वा सूचना दिनु पर्ने",
    book: "criminal-procedure",
    answerMode: "quote",
    description: "फौजदारी कार्यविधि दफा ४",
    expect: {
      chatMode: "verbatim",
      ...criminalProcSource(),
      mustMatch: [/दफा\s*:\s*४/, /जाहेरी दरखास्त/],
    },
  },

  // ── section-number quote (10) ───────────────────────────────────────
  {
    id: "sn-dafa-4-criminal",
    category: "section-number",
    message: "दफा ४",
    book: "criminal-code",
    answerMode: "quote",
    description: "Criminal code दफा ४ — general principles (not procedure)",
    fixArea: "retrieval",
    fixHint: "Book scope must win over दफा number homonyms",
    expect: {
      chatMode: "verbatim",
      ...criminalSource(),
      mustMatch: [/दफा\s*:\s*४/, /सामान्य रुपमा लागू/],
      mustNotMatch: [/जाहेरी दरखास्त/],
    },
  },
  {
    id: "sn-dafa-4-procedure",
    category: "section-number",
    message: "दफा ४",
    book: "criminal-procedure",
    answerMode: "quote",
    description: "Criminal procedure दफा ४ — FIR",
    expect: {
      chatMode: "verbatim",
      ...criminalProcSource(),
      mustMatch: [/दफा\s*:\s*४/, /जाहेरी दरखास्त/],
    },
  },
  {
    id: "sn-dafa-57-criminal",
    category: "section-number",
    message: "दफा ५७",
    book: "criminal-code",
    answerMode: "quote",
    description: "राष्ट्रपति आक्रमण — not civil debt दफा ५७",
    expect: {
      chatMode: "verbatim",
      ...criminalSource(),
      mustMatch: [/दफा\s*:\s*५७/, /राष्ट्रपति/],
      mustNotMatch: [/दामासाही/, /ऋणी/],
    },
  },
  {
    id: "sn-dafa-101-civil-proc",
    category: "section-number",
    message: "दफा १०१",
    book: "civil-procedure",
    answerMode: "quote",
    description: "प्रतिउत्तर २१ दिन",
    expect: {
      chatMode: "verbatim",
      ...civilProcSource(),
      mustMatch: [/दफा\s*:\s*१०१/, /एक्का[इी]स दिन/],
      mustNotMatch: [/पक्राउको बाधा/],
    },
  },
  {
    id: "sn-dafa-173-criminal",
    category: "section-number",
    message: "दफा १७३",
    book: "criminal-code",
    answerMode: "quote",
    description: "बाल विवाह — not civil धर्मपुत्र",
    expect: {
      chatMode: "verbatim",
      ...criminalSource(),
      mustMatch: [/दफा\s*:\s*१७३/, /बाल विवाह|बीस वर्ष नपुगी/],
      mustNotMatch: [/धर्मपुत्र/],
    },
  },
  {
    id: "sn-dafa-505-civil",
    category: "section-number",
    message: "दफा ५०५",
    book: "civil-code",
    answerMode: "quote",
    description: "Valid contract conditions",
    expect: {
      chatMode: "verbatim",
      ...civilSource(),
      mustMatch: [/दफा\s*:\s*५०५/, /कानून बमोजिम कार्यान्वयन हुने करार/],
    },
  },
  {
    id: "sn-dafa-57-procedure",
    category: "section-number",
    message: "दफा ५७",
    book: "criminal-procedure",
    answerMode: "quote",
    description: "पक्राउ पूर्जी — criminal procedure",
    expect: {
      chatMode: "verbatim",
      ...criminalProcSource(),
      mustMatch: [/दफा\s*:\s*५७/, /पक्राउ/],
      mustNotMatch: [/राष्ट्रपति/],
    },
  },
  {
    id: "sn-dafa-98-criminal",
    category: "section-number",
    message: "दफा ९८",
    book: "criminal-code",
    answerMode: "quote",
    description: "झुठ्ठा उजुरी — not civil divorce",
    expect: {
      chatMode: "verbatim",
      ...criminalSource(),
      mustMatch: [/दफा\s*:\s*९८/, /झुठ्ठा उजुरी|क्षति पुर्‍याउने/],
      mustNotMatch: [/सम्बन्ध विच्छेद/],
    },
  },
  {
    id: "sn-dafa-2-civil",
    category: "section-number",
    message: "दफा २",
    book: "civil-code",
    answerMode: "quote",
    description: "देवानी संहिता definitions",
    expect: {
      chatMode: "verbatim",
      ...civilSource(),
      mustMatch: [/दफा\s*:\s*२/, /परिभाषाः/],
    },
  },

  // ── hierarchical (8) ──────────────────────────────────────────────
  {
    id: "hi-dafa-57-ka",
    category: "hierarchical",
    message: "दफा ५७ को (क)",
    book: "criminal-code",
    answerMode: "quote",
    description: "खण्ड (क) — जन्मकैद",
    fixArea: "formatting",
    fixHint: "Hierarchical (क) should return full खण्ड text including जन्मकैद",
    expect: {
      chatMode: "verbatim",
      ...criminalSource(),
      mustMatch: [/दफा\s*:\s*५७/, /\(क\)/, /जन्मकैद|दश वर्ष|पाँच वर्ष/],
    },
  },
  {
    id: "hi-dafa-98-3",
    category: "hierarchical",
    message: "दफा ९८ को उपदफा (३)",
    book: "criminal-code",
    answerMode: "quote",
    description: "झुठ्ठा उजुरी — पीडित पक्ष",
    expect: {
      chatMode: "verbatim",
      ...criminalSource(),
      mustMatch: [/दफा\s*:\s*९८/, /\(३\)/, /पीडित/],
    },
  },
  {
    id: "hi-dafa-505-gha",
    category: "hierarchical",
    message: "दफा ५०५ को (घ)",
    book: "civil-code",
    answerMode: "quote",
    description: "कानूनसम्मत दायित्व condition",
    expect: {
      chatMode: "verbatim",
      ...civilSource(),
      mustMatch: [/दफा\s*:\s*५०५/, /\(घ\)|कानूनसम्मत दायित्व/],
    },
  },
  {
    id: "hi-dafa-173-1",
    category: "hierarchical",
    message: "दफा १७३ उपदफा (१)",
    book: "criminal-code",
    answerMode: "quote",
    description: "बाल विवाह age prohibition",
    expect: {
      chatMode: "verbatim",
      ...criminalSource(),
      mustMatch: [/दफा\s*:\s*१७३/, /बीस वर्ष नपुगी/],
    },
  },
  {
    id: "hi-dafa-101-1-civil-proc",
    category: "hierarchical",
    message: "दफा १०१ को (१)",
    book: "civil-procedure",
    answerMode: "quote",
    description: "एक्काइस दिन प्रतिउत्तर",
    expect: {
      chatMode: "verbatim",
      ...civilProcSource(),
      mustMatch: [/दफा\s*:\s*१०१/, /एक्का[इी]स दिन/],
    },
  },
  {
    id: "hi-dafa-4-1-procedure",
    category: "hierarchical",
    message: "दफा ४ को उपदफा (१)",
    book: "criminal-procedure",
    answerMode: "quote",
    description: "FIR duty",
    expect: {
      chatMode: "verbatim",
      ...criminalProcSource(),
      mustMatch: [/दफा\s*:\s*४/, /जाहेरी दरखास्त/],
    },
  },
  {
    id: "hi-dafa-517-ka",
    category: "hierarchical",
    message: "दफा ५१७ को (क)",
    book: "civil-code",
    answerMode: "quote",
    description: "Void contract — trade restriction",
    fixArea: "formatting",
    fixHint: "खण्ड (क) under उपदफा (२) not (४)",
    expect: {
      chatMode: "verbatim",
      ...civilSource(),
      mustMatch: [/दफा\s*:\s*५१७/, /\(क\)/, /पेशा, व्यापार वा व्यवसाय/],
    },
  },
  {
    id: "hi-roman-dafa2-up1-ka",
    category: "hierarchical",
    message: "dafa 57 ko ka",
    book: "criminal-code",
    answerMode: "quote",
    description: "Roman Nepali hierarchical ref",
    fixArea: "query-routing",
    fixHint: "extractKhandaFromQuery + book scope",
    expect: {
      chatMode: "verbatim",
      ...criminalSource(),
      mustMatch: [/दफा\s*:\s*५७/, /\(क\)/],
    },
  },

  // ── english (5) ───────────────────────────────────────────────────
  {
    id: "en-child-marriage-punishment",
    category: "english",
    message: "What is the punishment for child marriage under Nepali law?",
    book: "auto",
    answerMode: "advocate",
    description: "English → दफा १७३ punishment",
    fixArea: "llm",
    fixHint: "Respond in Nepali; cite अपराध संहिता १७३",
    expect: {
      chatMode: "advocate",
      mustMatch: [/तीन वर्ष/, /तीस हजार/, /१७३|173/],
      mustNotMatch: [/धर्मपुत्र/],
    },
  },
  {
    id: "en-written-reply-deadline",
    category: "english",
    message: "When must a defendant file a written reply in a civil case?",
    book: "civil-procedure",
    answerMode: "advocate",
    description: "दफा १०१ — 21 days",
    fixArea: "llm",
    fixHint: "Distinguish दफा १०० court issue vs १०१ defendant deadline",
    expect: {
      chatMode: "advocate",
      mustMatch: [/एक्का[इी]स दिन|२१ दिन/, /१०१/],
    },
  },
  {
    id: "en-false-complaint",
    category: "english",
    message: "What does the law say about filing a false criminal complaint?",
    book: "criminal-code",
    answerMode: "advocate",
    description: "दफा ९८",
    fixArea: "retrieval",
    fixHint: "English translation must map to झुठ्ठा उजुरी / दफा ९८; avoid empty-result 500",
    expect: {
      chatMode: "advocate",
      mustMatch: [/९८|झुठ्ठा/],
    },
  },
  {
    id: "en-contract-validity",
    category: "english",
    message: "What are the essential conditions for a valid contract?",
    book: "auto",
    answerMode: "advocate",
    description: "दफा ५०५ + ५१७",
    expect: {
      chatMode: "advocate",
      mustMatch: [/५०५/, /सहमति/, /सक्षमता/, /५१७/],
    },
  },
  {
    id: "en-marriage-age",
    category: "english",
    message: "What is the legal minimum age for marriage in Nepal?",
    book: "auto",
    answerMode: "advocate",
    description: "बीस वर्ष — दफा ७० + १७३",
    expect: {
      chatMode: "advocate",
      mustMatch: [/बीस वर्ष/, /१७३|७०/],
    },
  },

  // ── cross-document advocate (5) ─────────────────────────────────────
  {
    id: "xd-marriage-age-nepali",
    category: "cross-document",
    message: "विवाह गर्नका लागि कानुनले तोकेको उमेर कति हो र बालविवाह गरेमा कस्तो सजाय हुने व्यवस्था छ?",
    book: "auto",
    answerMode: "advocate",
    description: "देवानी ७० + अपराध १७३",
    expect: {
      chatMode: "advocate",
      mustMatch: [/बीस वर्ष/, /तीन वर्ष/, /देवानी/, /अपराध/, /१७३/, /७०/],
    },
  },
  {
    id: "xd-contract-validity-nepali",
    category: "cross-document",
    message: "कुनै पनि करार कानुनी रूपमा मान्य हुनका लागि पूरा गर्नुपर्ने आवश्यक सर्तहरू के-के हुन्?",
    book: "auto",
    answerMode: "advocate",
    description: "दफा ५०५ + ५१७",
    expect: {
      chatMode: "advocate",
      mustMatch: [/५०५/, /५१७/, /सहमति/, /बदर हुने/],
    },
  },
  {
    id: "xd-fir-and-investigation",
    category: "cross-document",
    message: "कसूरको जाहेरी दरखास्त कहाँ दिनुपर्छ र अनुसन्धान कसले गर्छ?",
    book: "auto",
    answerMode: "advocate",
    description: "फौजदारी कार्यविधि दफा ४ + ८",
    fixArea: "retrieval",
    fixHint: "Pin criminal-procedure; avoid civil-procedure homonyms",
    expect: {
      chatMode: "advocate",
      mustMatch: [/जाहेरी/, /अनुसन्धान/, /प्रहरी/],
    },
  },
  {
    id: "xd-bail-and-abscond",
    category: "cross-document",
    message: "जमानतको शर्त विपरीत अनुपस्थित भए के हुन्छ र पक्राउबाट भाग्न नहुने व्यवस्था के छ?",
    book: "criminal-code",
    answerMode: "advocate",
    description: "दफा १०० + १०१ criminal code",
    expect: {
      chatMode: "advocate",
      mustMatch: [/१००|१०१/, /जमानत|पक्राउ/],
    },
  },
  {
    id: "xd-divorce-maintenance",
    category: "cross-document",
    message: "सम्बन्ध विच्छेद भएपछि पत्नीलाई खर्च वा अंशबण्डाको व्यवस्था के छ?",
    book: "civil-code",
    answerMode: "advocate",
    description: "दफा ९७–१०१ family law",
    expect: {
      chatMode: "advocate",
      mustMatch: [/सम्बन्ध विच्छेद|विच्छेद/, /खर्च|अंश/],
    },
  },

  // ── scenario advocate (7) ─────────────────────────────────────────
  {
    id: "sc-pratiuttar-deadline",
    category: "scenario",
    message: "प्रतिउत्तर कहिले दाखिल गर्नुपर्छ?",
    book: "auto",
    answerMode: "advocate",
    description: "Civil procedure दफा १०१ + extension provisions",
    expect: {
      chatMode: "advocate",
      mustMatch: [/एक्का[इी]स दिन/, /१०१/],
    },
  },
  {
    id: "sc-bal-vivah-punishment",
    category: "scenario",
    message: "बालविवाह गरेमा कस्तो सजाय हुन्छ?",
    book: "auto",
    answerMode: "advocate",
    description: "अपराध संहिता १७३",
    expect: {
      chatMode: "advocate",
      mustMatch: [/तीन वर्ष/, /तीस हजार/, /१७३/],
    },
  },
  {
    id: "sc-false-report-consequence",
    category: "scenario",
    message: "झुठ्ठा उजुरी दिएमा के हुन्छ?",
    book: "criminal-code",
    answerMode: "advocate",
    description: "दफा ९८",
    expect: {
      chatMode: "advocate",
      mustMatch: [/९८/, /झुठ्ठा|क्षति/],
    },
  },
  {
    id: "sc-custody-24h",
    category: "scenario",
    message: "अनुसन्धानको लागि हिरासतमा राख्दा कति समयभित्र अदालतमा पेश गर्नुपर्छ?",
    book: "criminal-procedure",
    answerMode: "advocate",
    description: "दफा १४ — २४ घण्टा",
    fixArea: "retrieval",
    fixHint: "Pin दफा १४ (२४ घण्टा) not दफा १३ (हिरासत procedure only)",
    expect: {
      chatMode: "advocate",
      mustMatch: [/चौबीस घण्टा|२४ घण्टा/, /१४/],
    },
  },
  {
    id: "sc-murder-punishment",
    category: "scenario",
    message: "हत्या गरेमा कस्तो सजाय हुन्छ?",
    book: "criminal-code",
    answerMode: "advocate",
    description: "हत्या दफा retrieval",
    fixArea: "retrieval",
    fixHint: "Vector/keyword should hit हत्या दफा",
    expect: {
      chatMode: "advocate",
      mustMatch: [/हत्या/, /सजाय|कैद|जन्मकैद/],
    },
  },
  {
    id: "sc-theft",
    category: "scenario",
    message: "चोरी गरेमा कानूनले के व्यवस्था गर्छ?",
    book: "criminal-code",
    answerMode: "advocate",
    description: "चोरी सम्बन्धी दफा",
    fixArea: "retrieval",
    fixHint: "Topic/chapter retrieval for चोरी; avoid empty-result 500",
    expect: {
      chatMode: "advocate",
      mustMatch: [/चोरी/],
    },
  },
  {
    id: "sc-witness-examination",
    category: "scenario",
    message: "देवानी मुद्दामा साक्षी कसले उपस्थित गराउनुपर्छ?",
    book: "civil-procedure",
    answerMode: "advocate",
    description: "साक्ष सम्बन्धी दफा",
    expect: {
      chatMode: "advocate",
      mustMatch: [/साक्ष/],
    },
  },

  // ── negative (3) ──────────────────────────────────────────────────
  {
    id: "neg-nonexistent-dafa",
    category: "negative",
    message: "दफा ९९९९",
    book: "auto",
    answerMode: "quote",
    description: "Non-existent section — should not invent",
    fixArea: "negative-handling",
    fixHint: "Return clear not-found; no fabricated दफा",
    expect: {
      mustNotMatch: [/दफा\s*:\s*९९९९/],
    },
  },
  {
    id: "neg-jaywalking",
    category: "negative",
    message: "What is the penalty for jaywalking in Nepal?",
    book: "auto",
    answerMode: "advocate",
    description: "Out-of-corpus topic",
    fixArea: "negative-handling",
    fixHint: "Say not in provided laws; do not invent",
    expect: {
      chatMode: "advocate",
      mustMatch: [/स्पष्ट छैन|फेला|उपलब्ध छैन|cannot find|प्रदान गरिएको कानूनमा/i],
    },
  },
  {
    id: "neg-fake-act",
    category: "negative",
    message: "अन्तरिक्ष विवाह ऐन २०८० को दफा ५ को व्यवस्था के हो?",
    book: "auto",
    answerMode: "advocate",
    description: "Fabricated act name",
    fixArea: "negative-handling",
    fixHint: "Reject fabricated act",
    expect: {
      chatMode: "advocate",
      mustMatch: [/स्पष्ट छैन|फेला|उपलब्ध छैन|प्रदान गरिएको कानूनमा/i],
    },
  },

  // ── roman-mixed (2) ───────────────────────────────────────────────
  {
    id: "rm-dafa-101-mixed",
    category: "roman-mixed",
    message: "dafa 101 ma pratiuttar ko myad kati ho?",
    book: "civil-procedure",
    answerMode: "advocate",
    description: "Romanized Nepali → rewrite + दफा १०१",
    fixArea: "query-routing",
    fixHint: "query_meta.rewritten; translate to Devanagari",
    expect: {
      chatMode: "advocate",
      mustMatch: [/एक्का[इी]स दिन|२१/, /१०१/],
    },
  },
  {
    id: "rm-bal-vivah-roman",
    category: "roman-mixed",
    message: "bal vivah ko sajaya k ho?",
    book: "auto",
    answerMode: "advocate",
    description: "Roman → बाल विवाह सजाय",
    expect: {
      chatMode: "advocate",
      mustMatch: [/तीन वर्ष/, /१७३/],
    },
  },

  // ── factual (1) ───────────────────────────────────────────────────
  {
    id: "fac-civil-right-to-contract",
    category: "factual",
    message: "दफा २२",
    book: "civil-code",
    answerMode: "quote",
    description: "करार गर्न पाउने अधिकार",
    expect: {
      chatMode: "verbatim",
      ...civilSource(),
      mustMatch: [/दफा\s*:\s*२२/, /करार गर्ने अधिकार/],
    },
  },
];
