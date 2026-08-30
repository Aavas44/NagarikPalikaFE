import type { Metadata } from "next";
import localFont from "next/font/local";
import { Noto_Sans_Devanagari } from "next/font/google";
import { SajiloKanunProviders } from "@/components/sajilokanun/SajiloKanunProviders";
import "./sajilokanun.css";

const kalimati = localFont({
  src: "../../../fonts/sajilokanun/kalimati-regular.otf",
  variable: "--font-kalimati",
  display: "swap",
  weight: "400",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-devanagari",
});

export const metadata: Metadata = {
  title: "Sajilo Kanun — legal research and case workspace for Nepal",
  description:
    "Indexed statute research, case files, hearing lists, and reviewable drafts for advocates and law firms in Nepal.",
};

export default function SajiloKanunLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`sajilokanun-root ${kalimati.variable} ${notoDevanagari.variable} ${kalimati.className} antialiased`}
    >
      <SajiloKanunProviders>{children}</SajiloKanunProviders>
    </div>
  );
}
