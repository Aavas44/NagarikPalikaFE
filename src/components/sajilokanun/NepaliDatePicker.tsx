"use client";

import { useMemo } from "react";
import {
  BS_MONTHS_EN,
  BS_MONTHS_NE,
  BS_YEAR_OPTIONS,
  getDaysInBsMonth,
  type BsDate,
} from "@/lib/nepaliCalendar";
import { toDevanagariDigits } from "@/lib/sajilokanun/nepali-digits";
import { SheetSelect } from "./SheetSelect";
import styles from "./NepaliDatePicker.module.css";

export function NepaliDatePicker({
  value,
  onChange,
  locale = "ne",
  yearLabel = "Year (BS)",
  monthLabel = "Month",
  dayLabel = "Day",
}: {
  value: BsDate;
  onChange: (next: BsDate) => void;
  locale?: "en" | "ne";
  yearLabel?: string;
  monthLabel?: string;
  dayLabel?: string;
}) {
  const months = locale === "ne" ? BS_MONTHS_NE : BS_MONTHS_EN;
  const daysInMonth = getDaysInBsMonth(value.year, value.month);
  const useDevanagari = locale === "ne";

  const yearOptions = useMemo(
    () =>
      BS_YEAR_OPTIONS.map((y) => {
        const yearLabelText = useDevanagari
          ? `${toDevanagariDigits(String(y))} वि.सं.`
          : `${y} BS`;
        return { value: String(y), label: yearLabelText };
      }),
    [useDevanagari]
  );
  const monthOptions = useMemo(
    () => months.map((name, index) => ({ value: String(index + 1), label: name })),
    [months]
  );
  const dayOptions = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        return {
          value: String(day),
          label: useDevanagari ? toDevanagariDigits(String(day)) : String(day),
        };
      }),
    [daysInMonth, useDevanagari]
  );

  function update(field: keyof BsDate, raw: number) {
    const next: BsDate = { ...value, [field]: raw };
    const dim = getDaysInBsMonth(next.year, next.month);
    if (next.day > dim) next.day = dim;
    onChange(next);
  }

  return (
    <div className={styles.root}>
      <SheetSelect
        label={yearLabel}
        value={String(value.year)}
        options={yearOptions}
        onChange={(next) => update("year", Number(next))}
      />
      <SheetSelect
        label={monthLabel}
        value={String(value.month)}
        options={monthOptions}
        onChange={(next) => update("month", Number(next))}
      />
      <SheetSelect
        label={dayLabel}
        value={String(Math.min(value.day, daysInMonth))}
        options={dayOptions}
        onChange={(next) => update("day", Number(next))}
      />
    </div>
  );
}
