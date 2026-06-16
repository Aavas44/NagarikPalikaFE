import { Suspense } from "react";

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p style={{ padding: "2rem" }}>Loading…</p>}>{children}</Suspense>;
}
