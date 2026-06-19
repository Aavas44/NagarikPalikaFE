import { Suspense } from "react";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { getCombinedGlossaryTermCount } from "@/lib/glossary";
import { TerminologySearch } from "@/components/user/TerminologySearch";

export const dynamic = "force-dynamic";

export default async function TerminologyPage() {
  const glossaryTermsCount = await getCombinedGlossaryTermCount();

  return (
    <LanguageProvider>
      <UserNav />
      <main>
        <Suspense fallback={null}>
          <TerminologySearch glossaryTermsCount={glossaryTermsCount} />
        </Suspense>
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
