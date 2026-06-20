import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata("Admin — Nagarik Palika");

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
