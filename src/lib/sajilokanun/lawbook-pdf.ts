import fs from "fs";
import path from "path";
import { ALL_LAW_BOOK_IDS } from "./lawbooks";

const LAWFILES_DIR = path.join(process.cwd(), "Lawfiles");

/** Canonical PDFs served in the law preview UI. */
const BOOK_PDF_PATHS: Record<string, string> = {
  "civil-code": "मुलुकी_देवानी_(संहिता) ऐन,_२०७४.pdf",
  "criminal-code": "मुलुकी-अपराध-संहिता-ऐन-२०७४.pdf",
  "civil-procedure": "मुलुकी-देवानी-कार्यविधि-ऐन-२०७४.pdf",
  "criminal-procedure": "मुलुकी_फौजदारी_कार्यविधि_संहिता_२०७४(1).pdf",
};

export function resolveLawbookPdfPath(bookId: string): string | null {
  if (!ALL_LAW_BOOK_IDS.includes(bookId)) return null;
  const rel = BOOK_PDF_PATHS[bookId];
  if (!rel) return null;
  const full = path.join(LAWFILES_DIR, rel);
  return fs.existsSync(full) ? full : null;
}

export function resolveLawbookPdfRelPath(bookId: string): string | null {
  if (!ALL_LAW_BOOK_IDS.includes(bookId)) return null;
  const rel = BOOK_PDF_PATHS[bookId];
  if (!rel) return null;
  const full = path.join(LAWFILES_DIR, rel);
  return fs.existsSync(full) ? rel : null;
}
