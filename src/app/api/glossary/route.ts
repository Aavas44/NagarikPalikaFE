import { NextRequest, NextResponse } from "next/server";
import { searchGlossary } from "@/lib/glossary";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 30, 1), 100);

  if (!q.trim()) {
    return NextResponse.json({ query: q, total: 0, results: [] });
  }

  try {
    const { total, results } = await searchGlossary(q, limit);
    return NextResponse.json({ query: q, total, results });
  } catch (error) {
    console.error("Glossary search failed:", error);
    return NextResponse.json({ error: "Glossary unavailable" }, { status: 500 });
  }
}
