/** Bikram Sambat calendar utilities (BS 2000–2100). Data: sonill/nepali-dates (Panchanga-verified). */

import calendarRaw from "../../data/nepali-calendar-data.json";
import {
  BS_MONTHS_EN,
  BS_MONTHS_NE,
  type BsDate,
} from "./nepaliCalendarTypes";

export type { BsDate } from "./nepaliCalendarTypes";
export { BS_MONTHS_EN, BS_MONTHS_NE } from "./nepaliCalendarTypes";

const CALENDAR = calendarRaw as Record<string, number[]>;

const REF_BS: BsDate = { year: 2000, month: 1, day: 1 };
/** BS 2000/1/1 = AD 1943/4/14 (Nepali Patro reference). */
const REF_AD_UTC = Date.UTC(1943, 3, 14);

const MIN_BS_YEAR = 2000;
const MAX_BS_YEAR = 2100;

function assertYearInRange(year: number): void {
  if (year < MIN_BS_YEAR || year > MAX_BS_YEAR) {
    throw new RangeError(`BS year ${year} outside supported range ${MIN_BS_YEAR}–${MAX_BS_YEAR}`);
  }
}

export function getDaysInBsMonth(year: number, month: number): number {
  assertYearInRange(year);
  if (month < 1 || month > 12) return 30;
  return CALENDAR[String(year)][month - 1];
}

export function isValidBsDate(date: BsDate): boolean {
  if (date.year < MIN_BS_YEAR || date.year > MAX_BS_YEAR) return false;
  if (date.month < 1 || date.month > 12) return false;
  if (date.day < 1 || date.day > getDaysInBsMonth(date.year, date.month)) return false;
  return true;
}

function adToUtcMidnight(ad: Date): number {
  return Date.UTC(ad.getFullYear(), ad.getMonth(), ad.getDate());
}

function isAfter(a: BsDate, b: BsDate): boolean {
  if (a.year !== b.year) return a.year > b.year;
  if (a.month !== b.month) return a.month > b.month;
  return a.day > b.day;
}

/** Signed day offset from REF_BS to target. */
function diffBsFromRef(target: BsDate): number {
  if (target.year === REF_BS.year && target.month === REF_BS.month && target.day === REF_BS.day) {
    return 0;
  }

  if (isAfter(target, REF_BS)) {
    let days = 0;
    let y = REF_BS.year;
    let m = REF_BS.month;
    let d = REF_BS.day;

    while (y !== target.year || m !== target.month || d !== target.day) {
      if (y === target.year && m === target.month) {
        days += target.day - d;
        break;
      }
      const dim = getDaysInBsMonth(y, m);
      days += dim - d + 1;
      d = 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return days;
  }

  let days = 0;
  let y = REF_BS.year;
  let m = REF_BS.month;
  let d = REF_BS.day;

  while (y !== target.year || m !== target.month || d !== target.day) {
    d -= 1;
    if (d < 1) {
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      d = getDaysInBsMonth(y, m);
    }
    days -= 1;
  }
  return days;
}

export function bsToAd(bs: BsDate): Date {
  if (!isValidBsDate(bs)) {
    throw new RangeError(`Invalid BS date: ${bs.year}/${bs.month}/${bs.day}`);
  }
  const days = diffBsFromRef(bs);
  return new Date(REF_AD_UTC + days * 86_400_000);
}

export function adToBs(ad: Date): BsDate {
  let daysDiff = Math.round((adToUtcMidnight(ad) - REF_AD_UTC) / 86_400_000);

  let bsYear = REF_BS.year;
  let bsMonth = REF_BS.month;
  let bsDay = REF_BS.day;

  if (daysDiff >= 0) {
    while (daysDiff > 0) {
      const daysInMonth = getDaysInBsMonth(bsYear, bsMonth);
      const daysRemainingInMonth = daysInMonth - bsDay + 1;

      if (daysDiff >= daysRemainingInMonth) {
        daysDiff -= daysRemainingInMonth;
        bsDay = 1;
        bsMonth += 1;
        if (bsMonth > 12) {
          bsMonth = 1;
          bsYear += 1;
        }
      } else {
        bsDay += daysDiff;
        daysDiff = 0;
      }
    }
  } else {
    while (daysDiff < 0) {
      bsDay -= 1;
      if (bsDay < 1) {
        bsMonth -= 1;
        if (bsMonth < 1) {
          bsMonth = 12;
          bsYear -= 1;
        }
        bsDay = getDaysInBsMonth(bsYear, bsMonth);
      }
      daysDiff += 1;
    }
  }

  return { year: bsYear, month: bsMonth, day: bsDay };
}

export function getTodayBs(): BsDate {
  return adToBs(new Date());
}

export function formatBsDate(date: BsDate, locale: "en" | "ne"): string {
  const monthName = locale === "ne" ? BS_MONTHS_NE[date.month - 1] : BS_MONTHS_EN[date.month - 1];
  if (locale === "ne") {
    return `${date.year}/${String(date.month).padStart(2, "0")}/${String(date.day).padStart(2, "0")} (${monthName})`;
  }
  return `${date.year}-${monthName}-${date.day}`;
}

/** Fiscal year ending Ashad year for a BS date (Nepal FY ends Ashad). */
export function getFyEndAshadYear(bsYear: number, bsMonth: number): number {
  return bsMonth <= 3 ? bsYear : bsYear + 1;
}

/** Last day of Ashad in the given BS year (FY deadline). */
export function getAshadEndBs(ashadBsYear: number): BsDate {
  return {
    year: ashadBsYear,
    month: 3,
    day: getDaysInBsMonth(ashadBsYear, 3),
  };
}

export function daysBetweenAd(a: Date, b: Date): number {
  return Math.round((adToUtcMidnight(b) - adToUtcMidnight(a)) / 86_400_000);
}

/** Negative if a before b, positive if after, zero if equal. */
export function compareBsDates(a: BsDate, b: BsDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function isBsDateAfter(a: BsDate, b: BsDate): boolean {
  return compareBsDates(a, b) > 0;
}

/** Clamp date so it does not exceed max (inclusive). */
export function clampBsDate(date: BsDate, max: BsDate): BsDate {
  if (!isBsDateAfter(date, max)) {
    const dim = getDaysInBsMonth(date.year, date.month);
    return { ...date, day: Math.min(date.day, dim) };
  }
  return { ...max };
}

export const BS_YEAR_OPTIONS = Array.from({ length: MAX_BS_YEAR - MIN_BS_YEAR + 1 }, (_, i) =>
  MAX_BS_YEAR - i
);
