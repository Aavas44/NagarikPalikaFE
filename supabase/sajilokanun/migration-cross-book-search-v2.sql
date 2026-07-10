-- Weighted vector + FTS fusion for cross_book_legal_search (replaces GREATEST)
-- Run in Supabase SQL editor after migration-cross-book-search.sql

CREATE OR REPLACE FUNCTION cross_book_legal_search(
  query_embedding vector(768),
  query_text text,
  target_book_ids text[],
  match_count int
)
RETURNS TABLE (
  id uuid,
  book_id text,
  act_name text,
  dafa_no text,
  parichhed_no int,
  content text,
  filename text,
  section_label text,
  chapter text,
  section_title text,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tsq tsquery;
  cleaned text;
BEGIN
  cleaned := trim(
    regexp_replace(coalesce(query_text, ''), '[^\w\u0900-\u097F\s]', ' ', 'g')
  );
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');

  IF target_book_ids IS NULL OR array_length(target_book_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF cleaned <> '' THEN
    tsq := plainto_tsquery('simple', cleaned);
  END IF;

  RETURN QUERY
  SELECT
    lc.id,
    lc.book_id,
    lc.act_name,
    lc.dafa_no,
    lc.parichhed_no,
    lc.content,
    lc.filename,
    lc.section_label,
    lc.chapter,
    lc.section_title,
    (
      CASE
        WHEN tsq IS NOT NULL AND lc.search_vector @@ tsq THEN
          CASE
            WHEN least(1.0, (ts_rank_cd(lc.search_vector, tsq, 32)::float * 8.0)) >= 0.15 THEN
              0.4 * CASE
                WHEN lc.embedding IS NOT NULL THEN 1 - (lc.embedding <=> query_embedding)
                ELSE 0::float
              END
              + 0.6 * least(1.0, (ts_rank_cd(lc.search_vector, tsq, 32)::float * 8.0))
            ELSE
              0.7 * CASE
                WHEN lc.embedding IS NOT NULL THEN 1 - (lc.embedding <=> query_embedding)
                ELSE 0::float
              END
          END
        ELSE
          0.7 * CASE
            WHEN lc.embedding IS NOT NULL THEN 1 - (lc.embedding <=> query_embedding)
            ELSE 0::float
          END
      END
    )::float AS similarity
  FROM legal_chunks lc
  WHERE lc.book_id = ANY(target_book_ids)
    AND (
      lc.parichhed_no = 1
      OR (
        lc.embedding IS NOT NULL
        AND (1 - (lc.embedding <=> query_embedding)) > 0.60
      )
      OR (tsq IS NOT NULL AND lc.search_vector @@ tsq)
    )
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
