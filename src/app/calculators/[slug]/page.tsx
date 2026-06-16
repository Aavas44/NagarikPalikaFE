import { notFound } from "next/navigation";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { CalculatorPageContent } from "@/components/user/CalculatorPageContent";
import { isCalculatorSlug } from "@/lib/calculators";

interface CalculatorPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CalculatorPage({ params }: CalculatorPageProps) {
  const { slug } = await params;

  if (!isCalculatorSlug(slug)) {
    notFound();
  }

  return (
    <LanguageProvider>
      <UserNav />
      <main>
        <CalculatorPageContent slug={slug} />
      </main>
      <UserFooter />
    </LanguageProvider>
  );
}
