import { createClient } from "@supabase/supabase-js";
import ws from "ws";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: ws as unknown as typeof WebSocket,
    },
  });
}

export type MatchedChunk = {
  id: string;
  content: string;
  filename: string;
  page_number: number | null;
  section_label: string | null;
  chapter: string | null;
  section_title: string | null;
  subsection: string | null;
  similarity: number;
  /** JSON metadata from chunks table (references, hierarchy fields) */
  metadata?: Record<string, unknown> | null;
  fusion?: {
    vectorRank?: number;
    keywordRank?: number;
    rrfScore: number;
  };
};

export function formatSourceCitation(
  filename: string,
  pageNumber: number | null | undefined,
  sectionLabel?: string | null
): string {
  const parts = [filename];
  if (sectionLabel) parts.push(`दफा ${sectionLabel}`);
  if (pageNumber != null) parts.push(`p. ${pageNumber}`);
  return parts.join(" — ");
}
