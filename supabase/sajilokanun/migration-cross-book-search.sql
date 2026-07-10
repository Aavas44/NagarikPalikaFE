-- Metadata-bounded cross-book search: view + RPC
-- Run in Supabase SQL editor after schema.sql and migration-chunk-metadata.sql

CREATE OR REPLACE FUNCTION extract_parichhed_no(chapter_text text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  WITH normalized AS (
    SELECT translate(
      coalesce(chapter_text, ''),
      '०१२३४५६७८९',
      '0123456789'
    ) AS ch
  )
  SELECT CASE
    WHEN chapter_text IS NULL OR trim(chapter_text) = '' THEN NULL
    WHEN (SELECT ch FROM normalized) ~ 'परिच्छेद[–\-—]?\s*(\d+)' THEN
      (regexp_match((SELECT ch FROM normalized), 'परिच्छेद[–\-—]?\s*(\d+)'))[1]::int
    ELSE NULL
  END;
$$;

CREATE OR REPLACE VIEW legal_chunks AS
SELECT
  d.indexing_rule_id AS book_id,
  d.title AS act_name,
  coalesce(c.metadata->>'section_dafa', split_part(c.section_label, '.', 1)) AS dafa_no,
  extract_parichhed_no(c.chapter) AS parichhed_no,
  c.content,
  c.embedding,
  c.id,
  c.section_label,
  c.chapter,
  c.section_title,
  c.search_vector,
  d.filename
FROM chunks c
JOIN documents d ON d.id = c.document_id
WHERE c.embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_indexing_rule_id_idx
  ON documents (indexing_rule_id);

DROP FUNCTION IF EXISTS cross_book_legal_search(vector, text, text[], integer);

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
    greatest(
      CASE
        WHEN lc.embedding IS NOT NULL THEN 1 - (lc.embedding <=> query_embedding)
        ELSE 0::float
      END,
      CASE
        WHEN tsq IS NOT NULL AND lc.search_vector @@ tsq THEN
          least(1.0, (ts_rank_cd(lc.search_vector, tsq, 32)::float * 8.0))
        ELSE 0::float
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
