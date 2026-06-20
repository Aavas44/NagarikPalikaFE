import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata("Account — Nagarik Palika");

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
