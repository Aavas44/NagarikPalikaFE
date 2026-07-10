import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { TermsPageContent } from "@/components/user/TermsPageContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "प्रयोगका सर्तहरू — Terms & Conditions | Nagarik Palika",
  description:
    "नागरिक पालिका प्रयोग गर्दा लाग्ने सर्तहरू, अस्वीकरण, र जिम्मेवारी सीमा। Terms of use, disclaimers, and limitations for Nagarik Palika and Sajilo Kanun.",
  path: "/terms",
  keywords: [
    "Nagarik Palika terms",
    "नागरिक पालिका सर्तहरू",
    "Sajilo Kanun terms",
    "Nepal legal tool disclaimer",
  ],
});

export default function TermsPage() {
  return (
    <LanguageProvider>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Terms & Conditions", path: "/terms" },
        ])}
      />
      <UserNav />
      <main>
        <TermsPageContent />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
