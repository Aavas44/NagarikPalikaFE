import type { Metadata } from "next";
import { Suspense } from "react";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata("Payment — Nagarik Palika");

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p style={{ padding: "2rem" }}>Loading…</p>}>{children}</Suspense>;
}
