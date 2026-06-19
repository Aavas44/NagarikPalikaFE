import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { TemplatesListContent } from "@/components/user/TemplatesListContent";
import { getTemplates } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await getTemplates({ status: "published" });

  return (
    <LanguageProvider>
      <UserNav />
      <main>
        <TemplatesListContent templates={templates} />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
