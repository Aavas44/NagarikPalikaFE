"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  CALCULATOR_ITEMS,
  type CalculatorSlug,
} from "@/lib/calculators";
import { EmiCalculator } from "./EmiCalculator";
import { SalaryTaxCalculator } from "./SalaryTaxCalculator";
import { LandConverterCalculator } from "./LandConverterCalculator";
import styles from "@/app/user.module.css";

interface CalculatorPageContentProps {
  slug: CalculatorSlug;
}

function PlaceholderCalculator({ slug }: { slug: CalculatorSlug }) {
  const { msg } = useLanguage();
  const item = CALCULATOR_ITEMS.find((c) => c.slug === slug)!;

  return (
    <section className={styles.calculatorPage}>
      <div className={styles.calculatorPageInner}>
        <Link href="/calculators" className={styles.calculatorBack}>
          ← {msg.calculators.back}
        </Link>
        <h1>{msg.calculators[item.labelKey]}</h1>
        <p className={styles.calculatorComingSoon}>{msg.calculators.comingSoon}</p>
      </div>
    </section>
  );
}

export function CalculatorPageContent({ slug }: CalculatorPageContentProps) {
  if (slug === "emi") {
    return <EmiCalculator />;
  }
  if (slug === "salary-tax") {
    return <SalaryTaxCalculator />;
  }
  if (slug === "land-converter") {
    return <LandConverterCalculator />;
  }
  return <PlaceholderCalculator slug={slug} />;
}
