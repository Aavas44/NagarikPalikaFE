import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nagarik Palika",
  description:
    "Navigate government processes with confidence — terminology, templates, and guides.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
