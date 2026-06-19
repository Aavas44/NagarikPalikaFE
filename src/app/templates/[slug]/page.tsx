import { notFound } from "next/navigation";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { TemplatePageContent } from "@/components/user/TemplatePageContent";
import { getTemplate } from "@/lib/api";

interface TemplatePageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function TemplatePage({ params }: TemplatePageProps) {
  const { slug } = await params;

  let template;
  try {
    template = await getTemplate(slug);
  } catch {
    notFound();
  }

  return (
    <LanguageProvider>
      <UserNav />
      <main>
        <TemplatePageContent template={template} />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
