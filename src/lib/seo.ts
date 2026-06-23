import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export const SITE_NAME = "Nagarik Palika";

export const DEFAULT_DESCRIPTION =
  "Free Nepal government guide: 6,400+ legal terms (Kanuni Shabdakosh & SaralSewa), application templates, salary tax & EMI calculators, Sifaris help, and ward office terminology in English and Nepali.";

export const DEFAULT_KEYWORDS = [
  "Nagarik Palika",
  "Nepal government glossary",
  "Kanuni Shabdakosh",
  "Nepali legal dictionary",
  "Sifaris Nepal",
  "ward office Nepal",
  "government application forms Nepal",
  "salary tax calculator Nepal",
  "EMI calculator Nepal",
  "land converter Ropani Bigha",
  "nagarikta citizenship Nepal",
  "Malpot Lalpurja",
  "Saral Sewa glossary",
  "Nepal government processes",
];

const OG_IMAGE = "/nagarik-palika-logo.png";

export const NOINDEX_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

export const INDEX_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large",
    "max-video-preview": -1,
  },
};

export function absoluteUrl(path = "/"): string {
  const siteUrl = getSiteUrl();
  if (!path || path === "/") return siteUrl;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildPageMetadata(options: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(options.path ?? "/");
  const title = options.title;
  const description = options.description;
  const keywords = options.keywords ?? DEFAULT_KEYWORDS;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      alternateLocale: ["ne_NP"],
      type: "website",
      images: [
        {
          url: OG_IMAGE,
          width: 188,
          height: 88,
          alt: `${SITE_NAME} — Nepal government guide`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
    robots: options.noIndex ? NOINDEX_ROBOTS : INDEX_ROBOTS,
  };
}

export function buildNoIndexMetadata(title: string): Metadata {
  return {
    title,
    robots: NOINDEX_ROBOTS,
  };
}

export const CALCULATOR_SEO: Record<
  string,
  { title: string; description: string; keywords: string[] }
> = {
  "salary-tax": {
    title: "Salary Tax Calculator Nepal FY 2083/84 & 2082/83 — Income Tax Slab",
    description:
      "Free income tax calculator Nepal for FY 2083/84 and FY 2082/83. Estimate salary tax, monthly TDS, income tax slabs (married & unmarried), SSF/EPF deductions, and female rebate.",
    keywords: [
      "salary tax calculator Nepal",
      "income tax calculator Nepal",
      "tax calculator Nepal",
      "income tax slab in Nepal",
      "income tax rate in Nepal 2083/84",
      "income tax rate in Nepal 2082/83",
      "new income tax slab in Nepal",
      "income tax in Nepal",
      "Nepal tax calculator FY 2083/84",
      "Nepal tax calculator FY 2082/83",
      "SSF tax waiver",
    ],
  },
  emi: {
    title: "EMI Calculator Nepal — Loan Monthly Payment",
    description:
      "Calculate monthly EMI for home, vehicle, and personal loans in Nepal. See principal, interest breakdown, and amortization schedule.",
    keywords: ["EMI calculator Nepal", "loan calculator Nepal", "home loan EMI", "monthly installment calculator"],
  },
  "land-converter": {
    title: "Land Unit Converter Nepal — Bigha to Ropani, Sq Meter",
    description:
      "Free land unit converter Nepal: convert Bigha to Ropani, Aana, Dhur, and metric units (sq m, sq ft) from Lalpurja measurements using national standards.",
    keywords: [
      "land unit converter Nepal",
      "bigha to ropani",
      "Ropani to square meter",
      "Bigha converter Nepal",
      "land area converter Nepal",
      "land measurement Nepal",
      "Lalpurja land units",
      "area of land converter",
    ],
  },
  "land-registration-tax": {
    title: "Land Registration Tax Calculator Nepal",
    description:
      "Estimate stamp duty and Malpot registration fees for land transfers in Nepal.",
    keywords: ["land registration tax Nepal", "Malpot stamp duty", "property transfer tax Nepal"],
  },
  "capital-gains": {
    title: "Capital Gains Tax Calculator Nepal",
    description: "Estimate tax on property and investment capital gains in Nepal.",
    keywords: ["capital gains tax Nepal", "property sale tax Nepal"],
  },
  "vehicle-tax": {
    title: "Vehicle Tax Calculator Nepal FY 2083/84 — Bluebook Renewal",
    description:
      "Calculate Nepal vehicle tax, third-party insurance, renewal fee, and late fines for motorcycles, cars, and EVs (FY 2083/84 Bagmati rates). Enter last BS renewal date to estimate cost as of today.",
    keywords: [
      "vehicle tax calculator Nepal",
      "bluebook renewal cost Nepal",
      "motorcycle tax Nepal 2083",
      "road tax calculator Nepal",
      "EV tax Nepal",
    ],
  },
};

export const CONSIDERATION_SEO: Record<
  string,
  {
    title: string;
    description: string;
    keywords: string[];
    faq?: ReadonlyArray<{ q: string; a: string }>;
  }
> = {
  "property-construction/buying-land": {
    title: "Buying Land in Nepal — जग्गा किन्दा Lalpurja, Land Record & Checklist",
    description:
      "Guide to buying land in Nepal: verify Lalpurja and land record at Malpot, check tiro, rokka, road access, land measurement (Bigha, Ropani), ailani jagga risks, and land act rules — with real loss and savings examples.",
    keywords: [
      "buying land Nepal",
      "land for sale Nepal checklist",
      "जग्गा किन्दा ध्यान दिनुपर्ने कुराहरू",
      "jagga kinnda Nepal",
      "land record Nepal",
      "Malpot land record",
      "land revenue department Nepal",
      "Lalpurja verification",
      "land measurement Nepal",
      "bigha to ropani",
      "land unit converter Nepal",
      "area of land Lalpurja",
      "ailani jagga Nepal",
      "land act Nepal",
      "bhumi kharid Nepal",
      "जग्गा किन्ने",
      "Napinaksha land survey",
      "rokka fukua land Nepal",
    ],
    faq: [
      {
        q: "What should I check before buying land in Nepal?",
        a: "Verify Lalpurja at the land revenue office (Malpot), confirm land record and Tres Naksha for rokka or court disputes, check tiro and Ghar Jagga Kar receipts, match land measurement on the deed with Napinaksha, confirm legal road access, and review land classification before paying token money.",
      },
      {
        q: "How do I verify land record and Lalpurja in Nepal?",
        a: "Visit the Malpot (land revenue) office with the seller's Lalpurja and request verification against the government land record (khataiyan). Ask for Tres Naksha and Bhumi Sudhar records to see mortgages, rokka, or disputes. Do not rely on photocopies alone.",
      },
      {
        q: "What is ailani jagga and why does it matter when buying land?",
        a: "Ailani jagga refers to government or unregistered land that may be cultivated or occupied without formal title. Buying land without confirming it is not ailani or under acquisition can lead to invalid sales and loss of your payment. Always verify classification and ownership at Malpot and the local ward.",
      },
      {
        q: "How do Bigha and Ropani relate when checking land area?",
        a: "Nepal uses Hill units (Ropani, Aana, Paisa) and Terai units (Bigha, Kattha, Dhur) on Lalpurja. Compare deed figures with Napinaksha survey and use a land unit converter to cross-check area before you agree on price.",
      },
      {
        q: "Should I worry about badar and badel when buying farming land in Nepal?",
        a: "Yes, if the plot is khet, bari, or pakho near forest. Badar (monkeys) and badel (wild boar) can destroy crops even when papers are clean. Visit at dawn or dusk, ask neighbouring farmers, and budget for fencing or crop choices before you buy.",
      },
    ],
  },
};

export function websiteJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl,
    description: DEFAULT_DESCRIPTION,
    inLanguage: ["en", "ne"],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/terminology?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: getSiteUrl(),
    logo: absoluteUrl(OG_IMAGE),
    description: DEFAULT_DESCRIPTION,
    areaServed: {
      "@type": "Country",
      name: "Nepal",
    },
  };
}

export function faqJsonLd(items: ReadonlyArray<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function webApplicationJsonLd(options: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: options.name,
    description: options.description,
    url: absoluteUrl(options.path),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "NPR",
    },
    areaServed: {
      "@type": "Country",
      name: "Nepal",
    },
  };
}

export function definedTermSetJsonLd(options: {
  name: string;
  description: string;
  path: string;
  termCount: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: options.name,
    description: options.description,
    url: absoluteUrl(options.path),
    inDefinedTermSet: absoluteUrl("/terminology"),
    numberOfItems: options.termCount,
  };
}
