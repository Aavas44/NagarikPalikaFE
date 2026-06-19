import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { CalculatorsListContent } from "@/components/user/CalculatorsListContent";

export default function CalculatorsPage() {
  return (
    <LanguageProvider>
      <UserNav />
      <main>
        <CalculatorsListContent />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
