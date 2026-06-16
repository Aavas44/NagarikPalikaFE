import { Suspense } from "react";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { TerminologySearch } from "@/components/user/TerminologySearch";

export const dynamic = "force-dynamic";

export default function TerminologyPage() {
  return (
    <LanguageProvider>
      <UserNav />
      <main>
        <Suspense fallback={null}>
          <TerminologySearch />
        </Suspense>
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
