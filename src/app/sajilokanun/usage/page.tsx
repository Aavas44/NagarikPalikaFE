"use client";

import { useEffect, useState } from "react";
import { SajiloKanunAppShell } from "@/components/sajilokanun/SajiloKanunAppShell";
import { TokenUsageLogPanel } from "@/components/sajilokanun/TokenUsageLogPanel";
import { fetchSajiloKanunMe } from "@/lib/sajilokanun-access";
import { useLanguage } from "@/context/LanguageContext";
import emiStyles from "@/components/user/emi.module.css";

export default function SajiloKanunUsagePage() {
  const { msg } = useLanguage();
  const [scope, setScope] = useState<"self" | "team">("self");

  useEffect(() => {
    fetchSajiloKanunMe()
      .then((user) => {
        if (user.role === "admin") setScope("team");
      })
      .catch(() => {});
  }, []);

  return (
    <SajiloKanunAppShell
      title={msg.sajilokanun.usageLog.title}
      subtitle={
        scope === "team"
          ? "Team-wide token usage for your law firm."
          : msg.sajilokanun.usageLog.subtitle
      }
    >
      <TokenUsageLogPanel />
      <p className={emiStyles.emiDisclaimer} style={{ marginTop: "1rem" }}>
        Estimates only — billing depends on provider pricing and cache rates.
      </p>
    </SajiloKanunAppShell>
  );
}
