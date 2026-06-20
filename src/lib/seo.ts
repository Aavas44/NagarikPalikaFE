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
    title: "Salary Tax Calculator Nepal FY 2083/84",
    description:
      "Estimate annual and monthly income tax under Nepal salary rules (FY 2083/84). SSF, EPF, variable salary, female rebate, and progressive tax slabs.",
    keywords: [
      "salary tax calculator Nepal",
      "income tax Nepal 2083",
      "Nepal tax calculator",
      "SSF tax waiver",
      "FY 2083/84 tax slabs",
    ],
  },
  emi: {
    title: "EMI Calculator Nepal — Loan Monthly Payment",
    description:
      "Calculate monthly EMI for home, vehicle, and personal loans in Nepal. See principal, interest breakdown, and amortization schedule.",
    keywords: ["EMI calculator Nepal", "loan calculator Nepal", "home loan EMI", "monthly installment calculator"],
  },
  "land-converter": {
    title: "Land Unit Converter Nepal — Ropani, Bigha, Sq Meter",
    description:
      "Convert Lalpurja land area between Hill (Ropani) and Terai (Bigha) systems and metric units (sq m, sq ft) using national standards.",
    keywords: [
      "Ropani to square meter",
      "Bigha converter Nepal",
      "land area converter Nepal",
      "Lalpurja land units",
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
    title: "Vehicle Tax Calculator Nepal",
    description: "Estimate annual vehicle tax in Nepal by type and engine capacity.",
    keywords: ["vehicle tax Nepal", "road tax calculator Nepal"],
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
