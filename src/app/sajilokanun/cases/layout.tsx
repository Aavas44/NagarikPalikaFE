import { Suspense } from "react";

export default function SajiloKanunCasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <p style={{ padding: "2rem", textAlign: "center" }}>Loading…</p>
      }
    >
      {children}
    </Suspense>
  );
}
