import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { ConsiderationsListContent } from "@/components/user/ConsiderationsListContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "ध्यान दिनुपर्ने कुराहरू — Key Legal Considerations Nepal",
  description:
    "जग्गा किन्दा, घर बनाउँदा, कम्पनी दर्ता, बैंक ऋण — व्यावहारिक जाँचसूची। Practical checklists in English and Nepali: buying land, business, loans, property partition, foreign employment.",
  path: "/considerations",
  keywords: [
    "जग्गा किन्दा ध्यान दिनुपर्ने कुराहरू",
    "buying land Nepal checklist",
    "company registration Nepal",
    "कम्पनी दर्ता नेपाल",
    "bank loan Nepal",
    "बैंक ऋण नेपाल",
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
