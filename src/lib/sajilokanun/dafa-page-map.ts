import civilCode from "@/data/sajilokanun/dafa-page-map/civil-code.json";
import civilProcedure from "@/data/sajilokanun/dafa-page-map/civil-procedure.json";
import criminalCode from "@/data/sajilokanun/dafa-page-map/criminal-code.json";
import criminalProcedure from "@/data/sajilokanun/dafa-page-map/criminal-procedure.json";
import { toArabicDigits } from "./nepali-digits";

type DafaPageMapFile = {
  bookId: string;
  map: Record<string, number>;
};

const PAGE_MAPS: Record<string, Record<string, number>> = {
  "civil-code": (civilCode as DafaPageMapFile).map,
  "civil-procedure": (civilProcedure as DafaPageMapFile).map,
  "criminal-code": (criminalCode as DafaPageMapFile).map,
  "criminal-procedure": (criminalProcedure as DafaPageMapFile).map,
};

export function lookupDafaPage(
  bookId: string,
  sectionLabel: string
): number | null {
  const root = toArabicDigits(sectionLabel.split(".")[0]?.trim() ?? "");
  if (!root || !/^\d+$/.test(root)) return null;
  const page = PAGE_MAPS[bookId]?.[root];
  return page != null && page > 0 ? page : null;
}
