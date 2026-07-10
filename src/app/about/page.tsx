import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { AboutPageContent } from "@/components/user/AboutPageContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "हाम्रो बारेमा — About Nagarik Palika",
  description:
    "नागरिक पालिका के हो, किन बनाइयो, र नेपाली नागरिकलाई सरकारी प्रक्रिया बुझ्न कसरी मद्दत गर्छ। Independent guide to Nepal government processes, glossary, forms, and legal tools.",
  path: "/about",
  keywords: [
    "About Nagarik Palika",
    "नागरिक पालिका बारे",
    "Nepal citizen government guide",
    "Kanuni Shabdakosh",
    "Sajilo Kanun",
  ],
});

export default function AboutPage() {
  return (
    <LanguageProvider>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "About us", path: "/about" },
        ])}
      />
      <UserNav />
      <main>
        <AboutPageContent />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
