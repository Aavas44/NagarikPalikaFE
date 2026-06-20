import { NextRequest, NextResponse } from "next/server";
import { browseKanuniGlossary } from "@/lib/glossaryBrowse";

export async function GET(request: NextRequest) {
  const letter = request.nextUrl.searchParams.get("letter");
  const pageParam = request.nextUrl.searchParams.get("page");
  const limitParam = request.nextUrl.searchParams.get("limit");

  const page = Math.max(Number(pageParam) || 1, 1);
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);

  try {
    const data = await browseKanuniGlossary({ letter, page, limit });
    return NextResponse.json({ mode: "browse" as const, ...data });
  } catch (error) {
    console.error("Glossary browse failed:", error);
    return NextResponse.json({ error: "Glossary unavailable" }, { status: 500 });
  }
}
