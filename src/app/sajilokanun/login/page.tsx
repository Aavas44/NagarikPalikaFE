import type { Metadata } from "next";
import { SajiloKanunGate } from "@/components/sajilokanun/SajiloKanunGate";

export const metadata: Metadata = {
  title: "Sign in — Sajilo Kanun",
  description:
    "Sign in to Sajilo Kanun, or request a demo for invitation access.",
};

export default function SajiloKanunLoginPage() {
  return <SajiloKanunGate />;
}
