import type { BookScope } from "./lawbooks";
import type { QueryAnalysis } from "./query-analysis";

type TopicPinDef = {
  patterns: RegExp[];
  scope: BookScope;
  sections: string[];
  titles?: string[];
  retrievalQueries: string[];
  intent: string;
  legalIssues: string[];
  chapterName?: string;
  chapterNum?: string;
};

const PINS: TopicPinDef[] = [
  {
    patterns: [/फरार.*पक्राउ|पक्राउ पुर्जी.*फरार|अभियुक्त फरार/i],
    scope: "criminal-procedure",
    sections: ["65"],
    retrievalQueries: ["फरार अभियुक्त सुविधा", "दफा ६५"],
    intent: "फरार अभियुक्त",
    legalIssues: ["फरार"],
  },
  {
    patterns: [/एक वर्षभित्र किनारा|किनारा नलागे/i],
    scope: "criminal-procedure",
    sections: ["77"],
    retrievalQueries: ["एक वर्ष किनारा थुनामा", "दफा ७७"],
    intent: "किनारा नलागे",
    legalIssues: ["थुनामा"],
  },
  {
    patterns: [/पुर्पक्ष.*थुनामा पठाउ|थुनामा पठाउँछ|वर्षभन्दा बढी कैद.*थुनामा/i],
    scope: "criminal-procedure",
    sections: ["67"],
    retrievalQueries: ["पुर्पक्ष थुनामा", "दफा ६७"],
    intent: "पुर्पक्ष थुनामा",
    legalIssues: ["थुनामा"],
  },
  {
    patterns: [/अचल सम्पत्ति.*जिल्ला|घर\/जग्गा.*विवाद|जग्गा.*विवाद.*दर्ता/i],
    scope: "civil-procedure",
    sections: ["18"],
    retrievalQueries: ["अचल सम्पत्ति जिल्ला अदालत", "दफा १८"],
    intent: "अचल विवाद दर्ता",
    legalIssues: ["अधिकारक्षेत्र"],
  },
  {
    patterns: [/आर्थिक.*कमजोर.*शुल्क|शुल्क.*पछि बुझाउने|कमजोर.*अदालती शुल्क/i],
    scope: "civil-procedure",
    sections: ["65"],
    retrievalQueries: ["अदालती शुल्क पछि बुझाउने", "दफा ६५"],
    intent: "शुल्क पछि बुझाउने",
    legalIssues: ["अदालती शुल्क"],
    chapterNum: "6",
    chapterName: "अदालती शुल्क",
  },
  {
    patterns: [/म्याद तामेल भएको मितिले.*प्रतिउत्तर|बाटोको म्यादबाहेक.*प्रतिउत्तर/i],
    scope: "civil-procedure",
    sections: ["119"],
    retrievalQueries: ["प्रतिउत्तरपत्र म्याद तामेल", "दफा ११९"],
    intent: "प्रतिउत्तर म्याद तामेल पछि",
    legalIssues: ["प्रतिउत्तर", "म्याद"],
  },
  {
    patterns: [/काबु बाहिर|भूकम्प.*म्याद|पहिरो.*म्याद|सुत्केरी.*म्याद गुज्र/i],
    scope: "civil-procedure",
    sections: ["225"],
    retrievalQueries: ["काबु बाहिर म्याद थमाउ", "दफा २२५"],
    intent: "म्याद थमाउ",
    legalIssues: ["म्याद"],
  },
  {
    patterns: [/निजी रक्षाको अधिकार/i],
    scope: "criminal-code",
    sections: ["24", "25", "26"],
    retrievalQueries: ["निजी रक्षाको अधिकार", "दफा २४"],
    intent: "निजी रक्षा र कसूर",
    legalIssues: ["निजी रक्षा"],
  },
  {
    patterns: [/राजद्रोह|स्वतन्त्रता.*अखण्डता|भौगोलिक अखण्डता/i],
    scope: "criminal-code",
    sections: ["49"],
    retrievalQueries: ["राजद्रोह सजाय", "दफा ४९"],
    intent: "राजद्रोह सजाय",
    legalIssues: ["राजद्रोह"],
  },
  {
    patterns: [/जीवित.*विवाह|सम्बन्ध विच्छेद नहुँ|अर्को विवाह गरे/i],
    scope: "criminal-code",
    sections: ["175"],
    retrievalQueries: ["विवाहित अवस्थामा विवाह", "दफा १७५"],
    intent: "विवाहित अवस्थामा दोस्रो विवाह",
    legalIssues: ["बिगाम", "विवाह"],
  },
  {
    patterns: [/बालिकासँग.*करणी|१८ वर्षभन्दा कम.*करणी|मञ्जुरीमै करणी/i],
    scope: "criminal-code",
    sections: ["219"],
    retrievalQueries: ["बालिका करणी", "दफा २१९"],
    intent: "बालिकासँग करणी",
    legalIssues: ["करणी", "बालिका"],
  },
  {
    patterns: [/गर्भपतन|गर्भवती.*मञ्जुरी/i],
    scope: "criminal-code",
    sections: ["188"],
    retrievalQueries: ["गर्भपतन मञ्जुरी", "दफा १८८"],
    intent: "गर्भपतन",
    legalIssues: ["गर्भपतन"],
  },
  {
    patterns: [/अपहरण|शरीर बन्धक|बन्धक लिन/i],
    scope: "criminal-code",
    sections: ["211"],
    retrievalQueries: ["अपहरण शरीर बन्धक", "दफा २११"],
    intent: "अपहरण",
    legalIssues: ["अपहरण"],
  },
  {
    patterns: [/चिकित्सक.*लापरवाही|लापरवाहीले.*ज्यान/i],
    scope: "criminal-code",
    sections: ["232"],
    retrievalQueries: ["चिकित्सक लापरवाही", "दफा २३२"],
    intent: "चिकित्सक लापरवाही",
    legalIssues: ["लापरवाही"],
  },
  {
    patterns: [/बेइमानी.*सम्पत्ति|सम्पत्ति.*बेइमानी|लुकिछिपी/i],
    scope: "criminal-code",
    sections: ["241"],
    retrievalQueries: ["बेइमानी सम्पत्ति", "चोरी दफा २४१"],
    intent: "बेइमानी सम्पत्ति",
    legalIssues: ["चोरी", "बेइमानी"],
  },
  {
    patterns: [/झुक्यान|गल्ती विश्वास|ठगी/i],
    scope: "criminal-code",
    sections: ["249"],
    retrievalQueries: ["ठगी झुक्यान", "दफा २४९"],
    intent: "ठगी",
    legalIssues: ["ठगी"],
  },
  {
    patterns: [/कीर्ते|झुट्टा कुरा सच्याई/i],
    scope: "criminal-code",
    sections: ["276"],
    retrievalQueries: ["कीर्ते गर्न नहुने", "दफा २७६"],
    intent: "कीर्ते",
    legalIssues: ["कीर्ते"],
  },
  {
    patterns: [/गाई.*गोरु|गोरु मार/i],
    scope: "criminal-code",
    sections: ["289"],
    retrievalQueries: ["गाई गोरु मार्न", "दफा २८९"],
    intent: "गाई गोरु",
    legalIssues: ["गाई गोरु"],
  },
  {
    patterns: [/गाली|बेइज्जती|इज्जत.*प्रतिष्ठा/i],
    scope: "criminal-code",
    sections: ["305"],
    retrievalQueries: ["गाली बेइज्जती", "दफा ३०५"],
    intent: "गाली बेइज्जती",
    legalIssues: ["गाली"],
  },
  {
    patterns: [/अश्लील|छाडा शब्द|शान्ति भङ्ग/i],
    scope: "criminal-code",
    sections: ["118"],
    retrievalQueries: ["अश्लील शब्द शान्ति", "दफा ११८"],
    intent: "शान्ति भङ्ग",
    legalIssues: ["शान्ति"],
  },
  {
    patterns: [/पालनपोषण|अलपत्र छाड/i],
    scope: "criminal-code",
    sections: ["196"],
    retrievalQueries: ["पालनपोषण दायित्व", "दफा १९६"],
    intent: "पालनपोषण",
    legalIssues: ["पालनपोषण"],
  },
  {
    patterns: [
      /जाहेरी.*दर्ता.*(नमान|मानेन|इन्कार)|दरखास्त दर्ता गर्न (नमान|मानेन)/i,
      /jaheri.*darta.*(manena|manen|inkar|refus)/i,
      /prahari.*darta.*(manena|manen|inkar|refus)/i,
    ],
    scope: "criminal-procedure",
    sections: ["5"],
    retrievalQueries: ["जाहेरी दर्ता नमान", "दफा ५"],
    intent: "जाहेरी दर्ता",
    legalIssues: ["जाहेरी"],
  },
  {
    patterns: [/पक्राउ पुर्जी(?!.*फरार)|पक्राउ गर्नुपरे.*अनुमति/i],
    scope: "criminal-procedure",
    sections: ["9"],
    retrievalQueries: ["पक्राउ पुर्जी अनुमति", "दफा ९"],
    intent: "पक्राउ पुर्जी",
    legalIssues: ["पक्राउ"],
  },
  {
    patterns: [
      /सूर्योदय|सूर्यास्त.*खानतलासी|खानतलासी.*सूर्योदय|घर.*खानतलासी.*समय/i,
    ],
    scope: "criminal-procedure",
    sections: ["18"],
    retrievalQueries: [
      "सूर्योदय सूर्यास्त खानतलासी",
      "दफा १८ उपदफा ११",
    ],
    intent: "खानतलासी समय",
    legalIssues: ["खानतलासी", "सूर्योदय"],
  },
  {
    patterns: [/शरीर.*खानतलासी|महिला.*खानतलासी|खानतलासी.*महिला/i],
    scope: "criminal-procedure",
    sections: ["18"],
    retrievalQueries: ["महिला खानतलासी", "दफा १८"],
    intent: "खानतलासी",
    legalIssues: ["खानतलासी"],
  },
  {
    patterns: [/खानतलासी/i],
    scope: "criminal-procedure",
    sections: ["18"],
    retrievalQueries: ["खानतलासी", "दफा १८"],
    intent: "खानतलासी",
    legalIssues: ["खानतलासी"],
  },
  {
    patterns: [/शङ्कास्पद.*मृत्यु|अस्वाभाविक मृत्यु|मुचुल्का/i],
    scope: "criminal-procedure",
    sections: ["20"],
    retrievalQueries: ["शङ्कास्पद मृत्यु मुचुल्का", "दफा २०"],
    intent: "मुचुल्का",
    legalIssues: ["मुचुल्का"],
  },
  {
    patterns: [/सहयोग.*छुट|सजायमा.*प्रतिशत.*छुट/i],
    scope: "criminal-procedure",
    sections: ["33"],
    retrievalQueries: ["सहयोग सजाय छुट", "दफा ३३"],
    intent: "सजाय छुट",
    legalIssues: ["सहयोग"],
  },
  {
    patterns: [/सुत्केरी.*अशक्त|अशक्त अभियुक्त.*सट्टामा/i],
    scope: "criminal-procedure",
    sections: ["95"],
    retrievalQueries: ["सुत्केरी अभियुक्त प्रतिनिधि", "दफा ९५"],
    intent: "प्रतिनिधि उपस्थिति",
    legalIssues: ["उपस्थिति"],
  },
  {
    patterns: [/बालबालिका.*साक्षी|अशक्त साक्षी.*बकपत्र/i],
    scope: "criminal-procedure",
    sections: ["109"],
    retrievalQueries: ["साक्षी बकपत्र", "दफा १०९"],
    intent: "बकपत्र",
    legalIssues: ["साक्षी"],
  },
  {
    patterns: [/सरकार वादी|गम्भीर मुद्दा.*फिर्ता/i],
    scope: "criminal-procedure",
    sections: ["116"],
    retrievalQueries: ["सरकार वादी फिर्ता", "दफा ११६"],
    intent: "सरकार वादी फिर्ता",
    legalIssues: ["फिर्ता"],
  },
  {
    patterns: [/साबिती बयान|कसूर स्वीकार.*फैसला/i],
    scope: "criminal-procedure",
    sections: ["123"],
    retrievalQueries: ["साबिती बयान फैसला", "दफा १२३"],
    intent: "साबिती बयान",
    legalIssues: ["साबिती"],
  },
  {
    patterns: [/बलात्कार.*इजलास|हाडनाता करणी.*इजलास|बालबालिका.*सुनुवाइ/i],
    scope: "criminal-procedure",
    sections: ["129"],
    retrievalQueries: ["बन्द इजलास सुनुवाइ", "दफा १२९"],
    intent: "बन्द इजलास",
    legalIssues: ["इजलास"],
  },
  {
    patterns: [/पहिलो पटक.*कसूरदार|कारागारमा नराखी/i],
    scope: "criminal-procedure",
    sections: ["155"],
    retrievalQueries: ["पहिलो पटक सजाय विकल्प", "दफा १५५"],
    intent: "सजाय विकल्प",
    legalIssues: ["सजाय"],
  },
  {
    patterns: [/जन्मनासाथ नाम|नामको अधिकार/i],
    scope: "civil-code",
    sections: ["20"],
    retrievalQueries: ["नामको अधिकार", "दफा २०"],
    intent: "नामको अधिकार",
    legalIssues: ["नाम"],
  },
  {
    patterns: [/कम्पनी.*सङ्गठित|कानूनी व्यक्ति.*सम्पत्ति/i],
    scope: "civil-code",
    sections: ["43"],
    retrievalQueries: ["कानूनी व्यक्ति सम्पत्ति", "दफा ४३"],
    intent: "कानूनी व्यक्ति सम्पत्ति",
    legalIssues: ["कानूनी व्यक्ति"],
  },
  {
    patterns: [/उत्सव.*पति-पत्नी|पति-पत्नी स्वीकार|गन्धर्व/i],
    scope: "civil-code",
    sections: ["67"],
    titles: ["विवाह भएको मानिने"],
    retrievalQueries: ["विवाह भएको मानिने", "दफा ६७"],
    intent: "विवाह मानिने",
    legalIssues: ["विवाह"],
  },
  {
    patterns: [/सम्बन्ध विच्छेद|आपसी सहमतिमा.*विच्छेद/i],
    scope: "civil-code",
    sections: ["93"],
    retrievalQueries: ["सम्बन्ध विच्छेद", "दफा ९३"],
    intent: "सम्बन्ध विच्छेद",
    legalIssues: ["विच्छेद"],
  },
  {
    patterns: [/नाबालक.*संरक्षण|हितको संरक्षण|अभिभावक/i],
    scope: "civil-code",
    sections: ["120"],
    retrievalQueries: ["नाबालक संरक्षण", "दफा १२०"],
    intent: "संरक्षण",
    legalIssues: ["संरक्षण"],
  },
  {
    patterns: [/धर्मपुत्र|धर्मपुत्री/i],
    scope: "civil-code",
    sections: ["169", "170", "171"],
    retrievalQueries: ["धर्मपुत्र राख्न", "दफा १६९"],
    intent: "धर्मपुत्र",
    legalIssues: ["धर्मपुत्र"],
  },
  {
    patterns: [/सगोलको सम्पत्ति|अंश पाउने/i],
    scope: "civil-code",
    sections: ["205"],
    retrievalQueries: ["सगोल अंश", "दफा २०५"],
    intent: "अंश",
    legalIssues: ["अंश"],
  },
  {
    patterns: [/हकवालामा सर्ने|मृत्यु.*सम्पत्ति.*दायित्व/i],
    scope: "civil-code",
    sections: ["237", "238", "239"],
    titles: ["अपुताली", "उत्तराधिकार"],
    retrievalQueries: ["अपुताली परेको मानिने", "उत्तराधिकार", "दफा २३७"],
    intent: "अपुताली / उत्तराधिकार",
    legalIssues: ["अपुताली", "उत्तराधिकार"],
    chapterNum: "11",
    chapterName: "अपुताली सम्बन्धी व्यवस्था",
  },
  {
    patterns: [/हक छाडिदिने|विना मूल्य.*हक/i],
    scope: "civil-code",
    sections: ["404"],
    titles: ["दान"],
    retrievalQueries: ["दान हक छाड", "दफा ४०४"],
    intent: "दान",
    legalIssues: ["दान"],
  },
  {
    patterns: [/सम्झौता.*के भनिन्छ|करार.*के भनिन्छ|करारको परिभाषा/i],
    scope: "civil-code",
    sections: ["504"],
    titles: ["करार"],
    retrievalQueries: ["करार परिभाषा", "दफा ५०४"],
    intent: "करार परिभाषा",
    legalIssues: ["करार"],
  },
  {
    patterns: [/करार.*उल्लङ्घन|हानि-नोक्सानी बापत/i],
    scope: "civil-code",
    sections: ["537"],
    retrievalQueries: ["करार उल्लङ्घन क्षतिपूर्ति", "दफा ५३७"],
    intent: "करार उल्लङ्घन",
    legalIssues: ["क्षतिपूर्ति"],
  },
  {
    patterns: [/बाटो हिँड्ने|पानी निकास|सर्वसाधारण सेवा/i],
    scope: "civil-code",
    sections: ["462"],
    titles: ["सर्वसाधारण सेवा"],
    retrievalQueries: ["सर्वसाधारण सेवा", "दफा ४६२"],
    intent: "सर्वसाधारण सेवा",
    legalIssues: ["सेवा"],
  },
  {
    patterns: [/Tort|अपकृत्य|गल्तीले.*हानि|हानि पुर्याएमा.*दायित्व/i],
    scope: "civil-code",
    sections: ["8"],
    retrievalQueries: ["गल्ती क्षति दायित्व", "दफा ८"],
    intent: "क्षति दायित्व",
    legalIssues: ["क्षतिपूर्ति"],
  },
  {
    patterns: [/विदेशी नागरिक.*अचल|पूर्व स्वीकृति.*अचल/i],
    scope: "civil-code",
    sections: ["265"],
    retrievalQueries: ["विदेशी अचल सम्पत्ति", "दफा २६५"],
    intent: "विदेशी अचल",
    legalIssues: ["अचल"],
  },
  {
    patterns: [/भाडामा.*लिखित|बहालवाला.*लिखित/i],
    scope: "civil-code",
    sections: ["398"],
    retrievalQueries: ["भाडा लिखित", "दफा ३९८"],
    intent: "भाडा लिखित",
    legalIssues: ["भाडा"],
  },
  {
    patterns: [
      /नेपाल\s*सरकार.*अदालत.*(?:हैसियत|सहुलियत)/i,
      /विदेशी\s*नागरिक.*अदालत.*(?:हैसियत|सहुलियत)/i,
      /नेपाल\s*सरकार.*(?:हैसियत|सहुलियत).*अदालत|विदेशी\s*नागरिक.*(?:हैसियत|सहुलियत).*अदालत/i,
      /(?:हैसियत|सहुलियत).*नेपाल\s*सरकार|(?:हैसियत|सहुलियत).*विदेशी\s*नागरिक/i,
      /विदेशी\s*नागरिक.*हैसियत|नेपाल\s*सरकार.*हैसियत/i,
    ],
    scope: "civil-procedure",
    sections: ["9"],
    retrievalQueries: [
      "पक्षहरूको हैसियत समान",
      "नेपाल सरकार छुट्टै हैसियत सहुलियत",
      "दफा ९",
    ],
    intent: "पक्षहरूको हैसियत — सरकार वा विदेशी नागरिक",
    legalIssues: ["हैसियत", "सहुलियत", "नेपाल सरकार"],
    chapterNum: "2",
    chapterName: "देवानी कार्यविधि कानूनका सामान्य सिद्धान्त",
  },
  {
    patterns: [/विदेशमा.*करार|विदेशमा.*लेनदेन/i],
    scope: "civil-procedure",
    sections: ["20"],
    retrievalQueries: ["विदेश करार अधिकारक्षेत्र", "दफा २०"],
    intent: "विदेश अधिकारक्षेत्र",
    legalIssues: ["अधिकारक्षेत्र"],
  },
  {
    patterns: [/घरसार|५० हजार.*लिखत|प्रमाणित गराउनु/i],
    scope: "civil-procedure",
    sections: ["36"],
    retrievalQueries: ["घरसार प्रमाणित", "दफा ३६"],
    intent: "घरसार प्रमाणित",
    legalIssues: ["प्रमाणित"],
  },
  {
    patterns: [/राहदानी नम्बर|विदेशी.*फिराद/i],
    scope: "civil-procedure",
    sections: ["37"],
    retrievalQueries: ["विदेशी फिराद राहदानी", "दफा ३७"],
    intent: "फिराद विदेशी",
    legalIssues: ["फिराद"],
  },
  {
    patterns: [/हदम्याद नतोकिएको|फिरादपत्र दायर/i],
    scope: "civil-procedure",
    sections: ["48"],
    retrievalQueries: ["हदम्याद फिराद", "दफा ४८"],
    intent: "हदम्याद",
    legalIssues: ["हदम्याद"],
  },
  {
    patterns: [/सार्वजनिक बिदा.*म्याद|बिदा परेमा.*म्याद/i],
    scope: "civil-procedure",
    sections: ["51"],
    retrievalQueries: ["बिदा म्याद गणना", "दफा ५१"],
    intent: "म्याद गणना",
    legalIssues: ["म्याद"],
  },
  {
    patterns: [/अग्रिम सूचना|स्थानीय तहविरुद्ध/i],
    scope: "civil-procedure",
    sections: ["87", "264"],
    retrievalQueries: ["अग्रिम सूचना सरकार", "दफा ८७"],
    intent: "अग्रिम सूचना",
    legalIssues: ["सूचना"],
  },
  {
    patterns: [/म्याद तामेल.*साक्षी|दैलोमा टाँस/i],
    scope: "civil-procedure",
    sections: ["105"],
    retrievalQueries: ["म्याद तामेल साक्षी", "दफा १०५"],
    intent: "म्याद तामेल",
    legalIssues: ["तामेल"],
  },
  {
    patterns: [/दरपीठ|रीत नपुगेको.*फर्काउ/i],
    scope: "civil-procedure",
    sections: ["128"],
    retrievalQueries: ["दरपीठ फिराद", "दफा १२८"],
    intent: "दरपीठ",
    legalIssues: ["दरपीठ"],
  },
  {
    patterns: [/बेचबिखन.*नियुक्त|हक हस्तान्तरण.*नियुक्त/i],
    scope: "civil-procedure",
    sections: ["154"],
    retrievalQueries: ["अचल बिक्री प्रतिनिधि", "दफा १५४"],
    intent: "प्रतिनिधि",
    legalIssues: ["अचल"],
  },
];

function pinMatches(question: string, pin: TopicPinDef): boolean {
  return pin.patterns.some((re) => re.test(question));
}

export function findQuestionTopicPin(question: string): TopicPinDef | null {
  for (const pin of PINS) {
    if (pinMatches(question, pin)) return pin;
  }
  return null;
}

export function questionTopicPinToAnalysis(
  question: string,
  bookScope: BookScope
): QueryAnalysis | null {
  const pin = findQuestionTopicPin(question);
  if (!pin) return null;
  if (bookScope !== "auto" && bookScope !== pin.scope) return null;

  return {
    originalQuery: question,
    intent: pin.intent,
    legalIssues: pin.legalIssues,
    factsFromQuestion: [],
    retrievalQueries: pin.retrievalQueries,
    sectionHints: pin.sections.map((section) => ({
      section,
      act: pin.scope,
    })),
    chapterHints:
      pin.chapterNum && pin.chapterName
        ? [
            {
              chapter: pin.chapterNum,
              name: pin.chapterName,
              act: pin.scope,
            },
          ]
        : [],
    titleSearchHints: pin.titles ?? [],
    preferredAct: pin.scope,
  };
}

export function questionTopicSectionLookups(
  question: string
): Array<{ section: string; scope: BookScope }> {
  const pin = findQuestionTopicPin(question);
  if (!pin) return [];
  return pin.sections.map((section) => ({ section, scope: pin.scope }));
}
