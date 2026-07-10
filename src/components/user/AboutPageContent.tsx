"use client";

import { useLanguage } from "@/context/LanguageContext";
import { StaticInfoPage } from "./StaticInfoPage";

export function AboutPageContent() {
  const { msg } = useLanguage();
  const page = msg.aboutPage;

  return (
    <StaticInfoPage
      back={page.back}
      title={page.title}
      subtitle={page.subtitle}
      sections={page.sections}
    />
  );
}
