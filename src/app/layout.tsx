import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAdSense } from "@/components/GoogleAdSense";
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
      <body>
        {children}
        <GoogleAdSense />
        <Analytics />
      </body>
    </html>
  );
}
