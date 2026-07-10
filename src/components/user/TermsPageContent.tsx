"use client";

import { useLanguage } from "@/context/LanguageContext";
import { StaticInfoPage } from "./StaticInfoPage";

export function TermsPageContent() {
  const { msg } = useLanguage();
  const page = msg.termsPage;

  return (
    <StaticInfoPage
      back={page.back}
      title={page.title}
      subtitle={page.subtitle}
      lastUpdated={page.lastUpdated}
      sections={page.sections}
    />
  );
}
