import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { CalculatorsListContent } from "@/components/user/CalculatorsListContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Free Calculators for Tax, Loans & Land in Nepal",
  description:
    "Free online calculators for Nepal: salary income tax (FY 2083/84), EMI loan payments, land unit converter (Ropani/Bigha), and more government-related tools.",
  path: "/calculators",
  keywords: [
    "Nepal calculators",
    "salary tax calculator Nepal",
    "EMI calculator Nepal",
    "land converter Ropani",
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
