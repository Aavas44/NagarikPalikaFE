import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAdSense } from "@/components/GoogleAdSense";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  INDEX_ROBOTS,
  SITE_NAME,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";
import { getSiteUrl } from "@/lib/siteUrl";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_NAME} — Nepal Government Glossary, Forms & Calculators`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  applicationName: SITE_NAME,
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "government",
  robots: INDEX_ROBOTS,
  alternates: {
    canonical: getSiteUrl(),
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ne_NP"],
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Nepal Government Glossary, Forms & Calculators`,
    description: DEFAULT_DESCRIPTION,
    url: getSiteUrl(),
    images: [
      {
        url: "/nagarik-palika-logo.png",
        width: 188,
        height: 88,
        alt: `${SITE_NAME} — Nepal government guide`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Nepal Government Glossary, Forms & Calculators`,
    description: DEFAULT_DESCRIPTION,
    images: ["/nagarik-palika-logo.png"],
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />
        {children}
        <GoogleAdSense />
        <Analytics />
      </body>
    </html>
  );
}
