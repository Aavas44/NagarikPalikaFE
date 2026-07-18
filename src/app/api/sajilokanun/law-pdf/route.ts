import fs from "fs";
import path from "path";
import { ALL_LAW_BOOK_IDS } from "@/lib/sajilokanun/lawbooks";
import { resolveLawbookPdfPath } from "@/lib/sajilokanun/lawbook-pdf";
import { requireSajiloKanunAccessFromRequest } from "@/lib/sajilokanun-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireSajiloKanunAccessFromRequest(request);
  if (denied) return denied;

  const book = new URL(request.url).searchParams.get("book");
  if (!book || !ALL_LAW_BOOK_IDS.includes(book)) {
    return Response.json({ error: "Invalid book" }, { status: 400 });
  }

  const pdfPath = resolveLawbookPdfPath(book);
  if (!pdfPath) {
    return Response.json({ error: "PDF not found" }, { status: 404 });
  }

  const data = fs.readFileSync(pdfPath);
  const filename = path.basename(pdfPath);
  const encodedFilename = encodeURIComponent(filename);
  return new Response(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="lawbook.pdf"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
