import type { Metadata } from "next";
import { Suspense } from "react";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata("Authentication — Nagarik Palika");

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p style={{ padding: "2rem" }}>Loading…</p>}>{children}</Suspense>;
}
