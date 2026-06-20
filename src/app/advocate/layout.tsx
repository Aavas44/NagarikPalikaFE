import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata("Advocate Portal — Nagarik Palika");

export default function AdvocateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
