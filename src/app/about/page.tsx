import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { AboutPageContent } from "@/components/user/AboutPageContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "नागरिक पालिका बारे — About Nagarik Palika",
  description:
    "नागरिक पालिका किन बनाइयो, साइटमा के छ, र हामी के होइनौं। A plain-language companion for Nepal’s government offices, forms, and everyday law questions.",
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
