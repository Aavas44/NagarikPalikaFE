/**
 * Case document extraction — structured facts from uploaded pleadings / evidence.
 * JSON keys are Nepali to improve extraction fidelity from Devanagari source docs.
 */

export const DOCUMENT_EXTRACTION_SYSTEM_PROMPT = `तिमी नेपाली कानुनी कागजातबाट संरचित तथ्य निकाल्ने इन्जिन हो।
दिइएका कागजात/तस्बिरहरूमा जे लेखिएको छ त्यही मात्र प्रयोग गर। अनुमान, अनुमानित तथ्य, वा कागजातमा नभएका दफा/नाम/मिति थप नगर्न।

नियम:
- सम्पूर्ण स्ट्रिङ मानहरू नेपाली (देवनागरी) मा राख (अङ्क/केस नम्बर कागजातमा जस्तै भए त्यस्तै राख)।
- JSON मा तलका नेपाली कुञ्जीहरू मात्र प्रयोग गर्। अंग्रेजी कुञ्जी प्रयोग नगर्।
- कागजातमा नभएको फिल्डमा null राख (स्ट्रिङ फिल्ड) वा खाली एरे []।
- बिगो रकम सङ्ख्या (number) मा राख; अरू रकम/पाठ स्ट्रिङमा।
- केवल मान्य JSON वस्तु फर्काउ — markdown, व्याख्या, वा अतिरिक्त पाठ नराख।
- स्ट्रिङभित्रको नयाँ पङ्क्ति \\n ले लेख; उद्धरण चिन्ह \\" ले escape गर्; trailing comma नराख।
- JSON सधैं पूर्ण र parse हुने होस् (काटिएको वस्तु नफर्काउ)।

- वादी/निवेदक र प्रतिवादी/विपक्षी दुवै पक्ष १…N हुन सक्छन् — सधैं एरेमा राख (एउटा मात्र भए पनि)।
- फिराद/देवानीमा प्रायः "वादी"/"प्रतिवादी"; रिट/निवेदनमा "निवेदक"/"विपक्षी" — दुवै कुञ्जी भर् यदि कागजातमा छ; नत्र मिल्ने पक्ष एरेमा राख।
- तीनपुस्ते / बाबु-आमा / हजुरबुबा-हजुरआमा / छोरा-छोरी जस्ता नाताबाट "वंशावली" बनाउ। कागजातमा उल्लेख भएका व्यक्ति मात्र राख; अनुमान नगर्।
- वंशावलीमा प्रत्येक व्यक्तिको स्थिर "आईडी" (जस्तै vadi_1, vadi_1_babu, prati_1) राख; अभिभावक_आईडीहरूले माता/पिता जनाउ।
- पुस्ता: मूल व्यक्ति 0, बाबु/आमा −1, हजुरबुबा/हजुरआमा −2, छोरा/छोरी +1।

अनिवार्य JSON ढाँचा:
{
  "अदालत_विवरण": {
    "अदालतको_नाम": string | null,
    "मुद्दा_नं": string | null,
    "दर्ता_मिति_वि_सं": string | null,
    "मुद्दाको_विषय": string | null
  },
  "वादी_विवरण": [
    {
      "पूरा_नाम": string | null,
      "तीनपुस्ते": string | null,
      "ठेगाना": string | null,
      "नागरिकता_नं": string | null,
      "उमेर": string | null,
      "लिङ्ग": string | null,
      "सम्पर्क": string | null,
      "टिप्पणी": string | null
    }
  ],
  "निवेदक_विवरण": [
    {
      "पूरा_नाम": string | null,
      "तीनपुस्ते": string | null,
      "ठेगाना": string | null,
      "नागरिकता_नं": string | null,
      "उमेर": string | null,
      "लिङ्ग": string | null,
      "सम्पर्क": string | null,
      "टिप्पणी": string | null
    }
  ],
  "प्रतिवादी_विवरण": [
    {
      "पूरा_नाम": string | null,
      "तीनपुस्ते": string | null,
      "ठेगाना": string | null,
      "नागरिकता_नं": string | null,
      "उमेर": string | null,
      "लिङ्ग": string | null,
      "सम्पर्क": string | null,
      "टिप्पणी": string | null
    }
  ],
  "विपक्षी_विवरण": [
    {
      "पूरा_नाम": string | null,
      "तीनपुस्ते": string | null,
      "ठेगाना": string | null,
      "नागरिकता_नं": string | null,
      "उमेर": string | null,
      "लिङ्ग": string | null,
      "सम्पर्क": string | null,
      "टिप्पणी": string | null
    }
  ],
  "आर्थिक_तथा_तथ्य": {
    "बिगो_रकम_रु": number | null,
    "घटना_मिति_वि_सं": string | null,
    "तथ्य_सारांश": string | null
  },
  "कानूनी_आधार": {
    "उद्धृत_दफाहरू": string[],
    "हदम्याद_स्थिति": string | null
  },
  "माग_दाबी": {
    "मुख्य_दाबी": string | null,
    "अदालत_शुल्क_दाबी": string | null
  },
  "प्रमाणहरू": string[],
  "साक्षीहरू": string[],
  "वंशावली": {
    "मूल_व्यक्ति_आईडी": string | null,
    "व्यक्तिहरू": [
      {
        "आईडी": string,
        "नाम": string,
        "नाता": string | null,
        "पुस्ता": number | null,
        "अभिभावक_आईडीहरू": string[],
        "पक्ष": "वादी" | "प्रतिवादी" | "अन्य" | null,
        "टिप्पणी": string | null
      }
    ],
    "स्रोत_टिप्पणी": string | null
  }
}`;

export const DOCUMENT_EXTRACTION_USER_PROMPT = `तलका संलग्न कागजात/तस्बिरबाट माथिको नेपाली JSON ढाँचामा तथ्य निकाल।
सबै वादी/निवेदक र प्रतिवादी/विपक्षी अलग-अलग एरे वस्तुमा राख (१…N)। तीनपुस्ते र नाताबाट वंशावली पनि भर्।
कागजातमा स्पष्ट नभएका कुरा null वा [] राख। केवल JSON फर्काउ।`;

export type ExtractedPartyDetails = {
  पूरा_नाम: string | null;
  तीनपुस्ते: string | null;
  ठेगाना: string | null;
  नागरिकता_नं?: string | null;
  उमेर?: string | null;
  लिङ्ग?: string | null;
  सम्पर्क?: string | null;
  टिप्पणी?: string | null;
};

export type ExtractedFamilyTreePerson = {
  आईडी: string;
  नाम: string;
  नाता: string | null;
  पुस्ता: number | null;
  अभिभावक_आईडीहरू: string[];
  पक्ष: "वादी" | "प्रतिवादी" | "अन्य" | null;
  टिप्पणी: string | null;
};

export type ExtractedFamilyTree = {
  मूल_व्यक्ति_आईडी: string | null;
  व्यक्तिहरू: ExtractedFamilyTreePerson[];
  स्रोत_टिप्पणी: string | null;
};

export type ExtractedCaseDocument = {
  अदालत_विवरण: {
    अदालतको_नाम: string | null;
    मुद्दा_नं: string | null;
    दर्ता_मिति_वि_सं: string | null;
    मुद्दाको_विषय: string | null;
  };
  /** Plaintiffs / petitioners — always an array after normalization (1…N). */
  वादी_विवरण: ExtractedPartyDetails[];
  /** Alias of plaintiff side (writ/petition wording); mirrored for display. */
  निवेदक_विवरण: ExtractedPartyDetails[];
  /** Defendants / respondents — always an array after normalization. */
  प्रतिवादी_विवरण: ExtractedPartyDetails[];
  /** Alias of defendant side; mirrored for display. */
  विपक्षी_विवरण: ExtractedPartyDetails[];
  आर्थिक_तथा_तथ्य: {
    बिगो_रकम_रु: number | null;
    घटना_मिति_वि_सं: string | null;
    तथ्य_सारांश: string | null;
  };
  कानूनी_आधार: {
    उद्धृत_दफाहरू: string[];
    हदम्याद_स्थिति: string | null;
  };
  माग_दाबी: {
    मुख्य_दाबी: string | null;
    अदालत_शुल्क_दाबी: string | null;
  };
  प्रमाणहरू: string[];
  साक्षीहरू: string[];
  वंशावली: ExtractedFamilyTree;
};

export function emptyExtractedParty(): ExtractedPartyDetails {
  return {
    पूरा_नाम: null,
    तीनपुस्ते: null,
    ठेगाना: null,
    नागरिकता_नं: null,
    उमेर: null,
    लिङ्ग: null,
    सम्पर्क: null,
    टिप्पणी: null,
  };
}

/** @deprecated Use emptyExtractedParty */
export function emptyExtractedDefendant(): ExtractedPartyDetails {
  return emptyExtractedParty();
}

export function emptyExtractedFamilyTree(): ExtractedFamilyTree {
  return {
    मूल_व्यक्ति_आईडी: null,
    व्यक्तिहरू: [],
    स्रोत_टिप्पणी: null,
  };
}

export function emptyExtractedCaseDocument(): ExtractedCaseDocument {
  return {
    अदालत_विवरण: {
      अदालतको_नाम: null,
      मुद्दा_नं: null,
      दर्ता_मिति_वि_सं: null,
      मुद्दाको_विषय: null,
    },
    वादी_विवरण: [emptyExtractedParty()],
    निवेदक_विवरण: [emptyExtractedParty()],
    प्रतिवादी_विवरण: [emptyExtractedParty()],
    विपक्षी_विवरण: [emptyExtractedParty()],
    आर्थिक_तथा_तथ्य: {
      बिगो_रकम_रु: null,
      घटना_मिति_वि_सं: null,
      तथ्य_सारांश: null,
    },
    कानूनी_आधार: {
      उद्धृत_दफाहरू: [],
      हदम्याद_स्थिति: null,
    },
    माग_दाबी: {
      मुख्य_दाबी: null,
      अदालत_शुल्क_दाबी: null,
    },
    प्रमाणहरू: [],
    साक्षीहरू: [],
    वंशावली: emptyExtractedFamilyTree(),
  };
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "—") return null;
  return trimmed;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[,\s]/g, "").replace(/[०-९]/g, (d) =>
      String("०१२३४५६७८९".indexOf(d))
    );
    const n = Number(normalized);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function partyHasContent(d: ExtractedPartyDetails): boolean {
  return Boolean(
    d.पूरा_नाम ||
      d.तीनपुस्ते ||
      d.ठेगाना ||
      d.नागरिकता_नं ||
      d.उमेर ||
      d.लिङ्ग ||
      d.सम्पर्क ||
      d.टिप्पणी
  );
}

function partyIdentityKey(d: ExtractedPartyDetails): string {
  return [
    d.पूरा_नाम ?? "",
    d.नागरिकता_नं ?? "",
    d.तीनपुस्ते ?? "",
    d.ठेगाना ?? "",
  ]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function normalizePartyDetails(raw: unknown): ExtractedPartyDetails {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyExtractedParty();
  }
  const row = raw as Record<string, unknown>;
  return {
    पूरा_नाम: asNullableString(row["पूरा_नाम"] ?? row.full_name),
    तीनपुस्ते: asNullableString(row["तीनपुस्ते"] ?? row.teen_puste),
    ठेगाना: asNullableString(row["ठेगाना"] ?? row.address),
    नागरिकता_नं: asNullableString(row["नागरिकता_नं"] ?? row.citizenship_no),
    उमेर: asNullableString(row["उमेर"] ?? row.age),
    लिङ्ग: asNullableString(row["लिङ्ग"] ?? row.gender),
    सम्पर्क: asNullableString(row["सम्पर्क"] ?? row.contact ?? row.phone),
    टिप्पणी: asNullableString(row["टिप्पणी"] ?? row.notes),
  };
}

/** Accept single party object (legacy) or array. */
export function normalizePartyList(raw: unknown): ExtractedPartyDetails[] {
  if (Array.isArray(raw)) {
    const list = raw.map(normalizePartyDetails).filter(partyHasContent);
    return list.length > 0 ? list : [emptyExtractedParty()];
  }
  if (raw && typeof raw === "object") {
    return [normalizePartyDetails(raw)];
  }
  return [emptyExtractedParty()];
}

/** Merge two party lists, de-duplicating by name/citizenship. */
export function mergePartyLists(
  ...lists: ExtractedPartyDetails[][]
): ExtractedPartyDetails[] {
  const seen = new Set<string>();
  const out: ExtractedPartyDetails[] = [];
  for (const list of lists) {
    for (const party of list) {
      if (!partyHasContent(party)) continue;
      const key = partyIdentityKey(party);
      if (key === "|||" || seen.has(key)) continue;
      seen.add(key);
      out.push(party);
    }
  }
  return out.length > 0 ? out : [emptyExtractedParty()];
}

/** Plaintiff / petitioner side (वादी ∪ निवेदक). */
export function plaintiffParties(doc: ExtractedCaseDocument): ExtractedPartyDetails[] {
  return mergePartyLists(doc.वादी_विवरण, doc.निवेदक_विवरण);
}

/** Defendant / respondent side (प्रतिवादी ∪ विपक्षी). */
export function defendantParties(doc: ExtractedCaseDocument): ExtractedPartyDetails[] {
  return mergePartyLists(doc.प्रतिवादी_विवरण, doc.विपक्षी_विवरण);
}

function normalizePartySide(
  value: unknown
): ExtractedFamilyTreePerson["पक्ष"] {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (
    v === "वादी" ||
    v === "निवेदक" ||
    v === "plaintiff" ||
    v === "petitioner" ||
    v === "vadi" ||
    v === "badi" ||
    v === "nivedak"
  ) {
    return "वादी";
  }
  if (
    v === "प्रतिवादी" ||
    v === "विपक्षी" ||
    v === "defendant" ||
    v === "respondent" ||
    v === "prativadi" ||
    v === "prati" ||
    v === "bipakshi"
  ) {
    return "प्रतिवादी";
  }
  if (v === "अन्य" || v === "other") return "अन्य";
  return null;
}

function normalizeFamilyTreePerson(
  raw: unknown,
  index: number
): ExtractedFamilyTreePerson | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const name = asNullableString(row["नाम"] ?? row.name);
  if (!name) return null;
  const id =
    asNullableString(row["आईडी"] ?? row.id) ?? `person_${index + 1}`;
  const parentIdsRaw = row["अभिभावक_आईडीहरू"] ?? row.parent_ids ?? row.parentIds;
  const parentIds = Array.isArray(parentIdsRaw)
    ? parentIdsRaw
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];
  return {
    आईडी: id,
    नाम: name,
    नाता: asNullableString(row["नाता"] ?? row.relation),
    पुस्ता: asNullableNumber(row["पुस्ता"] ?? row.generation),
    अभिभावक_आईडीहरू: parentIds,
    पक्ष: normalizePartySide(row["पक्ष"] ?? row.side),
    टिप्पणी: asNullableString(row["टिप्पणी"] ?? row.notes),
  };
}

export function normalizeExtractedFamilyTree(raw: unknown): ExtractedFamilyTree {
  const empty = emptyExtractedFamilyTree();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const obj = raw as Record<string, unknown>;
  const peopleRaw = obj["व्यक्तिहरू"] ?? obj.people ?? obj.persons;
  const people = Array.isArray(peopleRaw)
    ? peopleRaw
        .map((item, index) => normalizeFamilyTreePerson(item, index))
        .filter((item): item is ExtractedFamilyTreePerson => item !== null)
    : [];
  const rootId = asNullableString(
    obj["मूल_व्यक्ति_आईडी"] ?? obj.root_person_id ?? obj.rootPersonId
  );
  return {
    मूल_व्यक्ति_आईडी:
      rootId && people.some((p) => p.आईडी === rootId)
        ? rootId
        : people[0]?.आईडी ?? null,
    व्यक्तिहरू: people,
    स्रोत_टिप्पणी: asNullableString(
      obj["स्रोत_टिप्पणी"] ?? obj.source_note ?? obj.sourceNote
    ),
  };
}

/**
 * If the model omitted वंशावली, build a minimal tree from party names + तीनपुस्ते text.
 */
export function ensureFamilyTreeFromParties(
  doc: ExtractedCaseDocument
): ExtractedCaseDocument {
  if (doc.वंशावली.व्यक्तिहरू.length > 0) return doc;

  const people: ExtractedFamilyTreePerson[] = [];
  plaintiffParties(doc).forEach((plaintiff, index) => {
    if (!plaintiff.पूरा_नाम) return;
    const id = `vadi_${index + 1}`;
    const lineageId = `${id}_lineage`;
    people.push({
      आईडी: id,
      नाम: plaintiff.पूरा_नाम,
      नाता: "वादी",
      पुस्ता: 0,
      अभिभावक_आईडीहरू: plaintiff.तीनपुस्ते ? [lineageId] : [],
      पक्ष: "वादी",
      टिप्पणी: plaintiff.तीनपुस्ते,
    });
    if (plaintiff.तीनपुस्ते) {
      people.push({
        आईडी: lineageId,
        नाम: plaintiff.तीनपुस्ते,
        नाता: "तीनपुस्ते",
        पुस्ता: -1,
        अभिभावक_आईडीहरू: [],
        पक्ष: "वादी",
        टिप्पणी: "वादी/निवेदकको तीनपुस्ते (कागजातबाट)",
      });
    }
  });

  defendantParties(doc).forEach((defendant, index) => {
    if (!defendant.पूरा_नाम) return;
    const id = `prati_${index + 1}`;
    const lineageId = `${id}_lineage`;
    people.push({
      आईडी: id,
      नाम: defendant.पूरा_नाम,
      नाता: "प्रतिवादी",
      पुस्ता: 0,
      अभिभावक_आईडीहरू: defendant.तीनपुस्ते ? [lineageId] : [],
      पक्ष: "प्रतिवादी",
      टिप्पणी: defendant.तीनपुस्ते,
    });
    if (defendant.तीनपुस्ते) {
      people.push({
        आईडी: lineageId,
        नाम: defendant.तीनपुस्ते,
        नाता: "तीनपुस्ते",
        पुस्ता: -1,
        अभिभावक_आईडीहरू: [],
        पक्ष: "प्रतिवादी",
        टिप्पणी: "प्रतिवादी/विपक्षीको तीनपुस्ते (कागजातबाट)",
      });
    }
  });

  if (people.length === 0) return doc;

  return {
    ...doc,
    वंशावली: {
      मूल_व्यक्ति_आईडी:
        people.find((p) => p.आईडी.startsWith("vadi_"))?.आईडी ?? people[0].आईडी,
      व्यक्तिहरू: people,
      स्रोत_टिप्पणी: "तीनपुस्ते/पक्ष विवरणबाट स्वतः बनाइएको",
    },
  };
}

/** Accept Nepali keys (preferred) or English keys from the sample schema. */
export function normalizeExtractedCaseDocument(raw: unknown): ExtractedCaseDocument {
  const base = emptyExtractedCaseDocument();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;

  const court = (obj["अदालत_विवरण"] ?? obj.court_details) as
    | Record<string, unknown>
    | undefined;
  const plaintiffsRaw =
    obj["वादी_विवरण"] ?? obj.plaintiff_details ?? obj.plaintiffs;
  const petitionersRaw =
    obj["निवेदक_विवरण"] ?? obj.petitioner_details ?? obj.petitioners;
  const defendantsRaw =
    obj["प्रतिवादी_विवरण"] ??
    obj["प्रतिवादीहरू"] ??
    obj.defendant_details ??
    obj.defendants;
  const respondentsRaw =
    obj["विपक्षी_विवरण"] ?? obj.respondent_details ?? obj.respondents;
  const facts = (obj["आर्थिक_तथा_तथ्य"] ?? obj.financial_and_facts) as
    | Record<string, unknown>
    | undefined;
  const legal = (obj["कानूनी_आधार"] ?? obj.legal_grounds) as
    | Record<string, unknown>
    | undefined;
  const prayers = (obj["माग_दाबी"] ?? obj.prayers) as
    | Record<string, unknown>
    | undefined;
  const familyTreeRaw = obj["वंशावली"] ?? obj.family_tree ?? obj.familyTree;

  if (court) {
    base.अदालत_विवरण = {
      अदालतको_नाम: asNullableString(court["अदालतको_नाम"] ?? court.court_name),
      मुद्दा_नं: asNullableString(court["मुद्दा_नं"] ?? court.case_number),
      दर्ता_मिति_वि_सं: asNullableString(
        court["दर्ता_मिति_वि_सं"] ?? court.registration_date_bs
      ),
      मुद्दाको_विषय: asNullableString(court["मुद्दाको_विषय"] ?? court.case_subject),
    };
  }

  const plaintiffs = mergePartyLists(
    normalizePartyList(plaintiffsRaw),
    normalizePartyList(petitionersRaw)
  );
  const defendants = mergePartyLists(
    normalizePartyList(defendantsRaw),
    normalizePartyList(respondentsRaw)
  );

  base.वादी_विवरण = plaintiffs;
  base.निवेदक_विवरण = plaintiffs.map((p) => ({ ...p }));
  base.प्रतिवादी_विवरण = defendants;
  base.विपक्षी_विवरण = defendants.map((p) => ({ ...p }));

  if (facts) {
    base.आर्थिक_तथा_तथ्य = {
      बिगो_रकम_रु: asNullableNumber(facts["बिगो_रकम_रु"] ?? facts.bigo_amount_npr),
      घटना_मिति_वि_सं: asNullableString(
        facts["घटना_मिति_वि_सं"] ?? facts.incident_date_bs
      ),
      तथ्य_सारांश: asNullableString(facts["तथ्य_सारांश"] ?? facts.fact_summary),
    };
  }

  if (legal) {
    base.कानूनी_आधार = {
      उद्धृत_दफाहरू: asStringArray(
        legal["उद्धृत_दफाहरू"] ?? legal.sections_invoked
      ),
      हदम्याद_स्थिति: asNullableString(
        legal["हदम्याद_स्थिति"] ?? legal.statute_of_limitations_status
      ),
    };
  }

  if (prayers) {
    base.माग_दाबी = {
      मुख्य_दाबी: asNullableString(prayers["मुख्य_दाबी"] ?? prayers.main_claim),
      अदालत_शुल्क_दाबी: asNullableString(
        prayers["अदालत_शुल्क_दाबी"] ?? prayers.court_fee_claim
      ),
    };
  }

  base.प्रमाणहरू = asStringArray(obj["प्रमाणहरू"] ?? obj.evidence);
  base.साक्षीहरू = asStringArray(obj["साक्षीहरू"] ?? obj.witnesses);
  base.वंशावली = normalizeExtractedFamilyTree(familyTreeRaw);

  return ensureFamilyTreeFromParties(base);
}

/** Escape raw control characters that appear inside JSON string literals. */
function escapeControlCharsInStrings(input: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      if (ch.charCodeAt(0) < 0x20) {
        out += `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
    }
    out += ch;
  }
  return out;
}

/** Best-effort cleanup of common LLM JSON defects. */
export function repairLlmJson(text: string): string {
  let s = text.trim();
  s = s.replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\uFEFF]/g, "");

  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1].trim();

  const start = s.indexOf("{");
  if (start < 0) {
    throw new Error("Extraction did not return JSON");
  }
  s = s.slice(start);

  s = s
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let lastBalanced = -1;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          lastBalanced = i;
          break;
        }
      }
    }
    if (lastBalanced >= 0) {
      s = s.slice(0, lastBalanced + 1);
    } else {
      s = escapeControlCharsInStrings(s);
      s = s.replace(/,(\s*[}\]])/g, "$1");
      const openCurly = (s.match(/{/g) ?? []).length;
      const closeCurly = (s.match(/}/g) ?? []).length;
      const openSquare = (s.match(/\[/g) ?? []).length;
      const closeSquare = (s.match(/]/g) ?? []).length;
      let inStr = false;
      let esc = false;
      for (const ch of s) {
        if (inStr) {
          if (esc) {
            esc = false;
            continue;
          }
          if (ch === "\\") {
            esc = true;
            continue;
          }
          if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
      }
      if (inStr) s += '"';
      s = s.replace(/,\s*$/, "");
      for (let i = 0; i < openSquare - closeSquare; i++) s += "]";
      for (let i = 0; i < openCurly - closeCurly; i++) s += "}";
    }
  }

  s = escapeControlCharsInStrings(s);
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return s;
}

export function parseExtractedJsonText(text: string): ExtractedCaseDocument {
  const repaired = repairLlmJson(text);
  try {
    const parsed = JSON.parse(repaired) as unknown;
    return normalizeExtractedCaseDocument(parsed);
  } catch (err) {
    const preview = repaired.slice(Math.max(0, 1350), 1450);
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[extract-document] JSON parse failed near:", preview);
    throw new Error(
      `Extraction returned invalid JSON (${detail}). Try fewer/clearer pages, or a higher-quality scan.`
    );
  }
}
