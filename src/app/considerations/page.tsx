import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { ConsiderationsListContent } from "@/components/user/ConsiderationsListContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Key Legal Considerations in Nepal — Property, Business, Loans & More",
  description:
    "Practical checklists for buying land, building a house, company registration, bank loans, property partition, foreign employment, and study abroad in Nepal.",
  path: "/considerations",
  keywords: [
    "buying land Nepal checklist",
    "company registration Nepal",
    "bank loan Nepal",
    "property partition Nepal",
    "foreign employment Nepal",
  ],
});

export default function ConsiderationsPage() {
  return (
    <LanguageProvider>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Key Considerations", path: "/considerations" },
        ])}
      />
      <UserNav />
      <main>
        <ConsiderationsListContent />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
