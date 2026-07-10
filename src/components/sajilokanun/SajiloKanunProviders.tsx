"use client";

import type { ReactNode } from "react";
import { LanguageProvider } from "@/context/LanguageContext";

export function SajiloKanunProviders({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
