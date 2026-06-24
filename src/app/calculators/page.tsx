import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { CalculatorsListContent } from "@/components/user/CalculatorsListContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Free Calculators Nepal — कर, ऋण र जग्गा | Tax, Loans & Land",
  description:
    "निःशुल्क क्याल्कुलेटर — तलब कर (२०८३/८४, २०८२/८३), EMI, बिघा–रोपनी। Free calculators: salary tax, loan EMI, land unit converter — English and Nepali.",
  path: "/calculators",
  keywords: [
    "Nepal calculators",
    "क्याल्कुलेटर नेपाल",
    "salary tax calculator Nepal",
    "तलब कर क्याल्कुलेटर",
    "EMI calculator Nepal",
    "land converter Ropani",
    "बिघा रोपनी",
    "free tax tools Nepal",
  ],
});

export default function CalculatorsPage() {
  return (
    <LanguageProvider>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Calculators", path: "/calculators" },
        ])}
      />
      <UserNav />
      <main>
        <CalculatorsListContent />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
