-- Re-balanced advocate hybrid scoring defaults (pool 120, lower metadata boosts)
-- Run after migration-advocate-hybrid-search-v2-exact-dafas.sql

CREATE OR REPLACE FUNCTION advocate_hybrid_search(
  query_embedding vector(768),
  query_text text,
  target_book_ids text[],
  match_count int,
  hint_act text DEFAULT NULL,
  hint_book_id text DEFAULT NULL,
  hint_parichhed int DEFAULT NULL,
  hint_dafa_start int DEFAULT NULL,
  hint_dafa_end int DEFAULT NULL,
  hint_exact_dafa int DEFAULT NULL,
  vector_num_candidates int DEFAULT 120,
  act_boost float DEFAULT 2.5,
  parichhed_boost float DEFAULT 0.8,
  dafa_range_boost float DEFAULT 0.5,
  exact_dafa_boost float DEFAULT 1.0,
  keyword_boost float DEFAULT 1.5,
  hint_exact_dafas int[] DEFAULT NULL
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
  WITH vector_pool AS (
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
      lc.search_vector,
      (1 - (lc.embedding <=> query_embedding))::float AS vector_score
    FROM legal_chunks lc
    WHERE lc.book_id = ANY(target_book_ids)
      AND lc.embedding IS NOT NULL
    ORDER BY lc.embedding <=> query_embedding
    LIMIT GREATEST(vector_num_candidates, match_count)
  ),
  exact_pool AS (
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
      lc.search_vector,
      (1 - (lc.embedding <=> query_embedding))::float AS vector_score
    FROM legal_chunks lc
    WHERE lc.book_id = ANY(target_book_ids)
      AND lc.embedding IS NOT NULL
      AND lc.id NOT IN (SELECT vp.id FROM vector_pool vp)
      AND (
        (
          hint_exact_dafas IS NOT NULL
          AND array_length(hint_exact_dafas, 1) > 0
          AND extract_dafa_arabic(lc.dafa_no) = ANY(hint_exact_dafas)
        )
        OR (
          hint_exact_dafa IS NOT NULL
          AND extract_dafa_arabic(lc.dafa_no) = hint_exact_dafa
        )
      )
  ),
  combined_pool AS (
    SELECT * FROM vector_pool
    UNION ALL
    SELECT * FROM exact_pool
  ),
  scored AS (
    SELECT
      vp.id,
      vp.book_id,
      vp.act_name,
      vp.dafa_no,
      vp.parichhed_no,
      vp.content,
      vp.filename,
      vp.section_label,
      vp.chapter,
      vp.section_title,
      (
        vp.vector_score
        + CASE
            WHEN hint_book_id IS NOT NULL AND vp.book_id = hint_book_id THEN act_boost
            WHEN hint_act IS NOT NULL AND vp.act_name ILIKE '%' || hint_act || '%' THEN act_boost
            ELSE 0::float
          END
        + CASE
            WHEN hint_parichhed IS NOT NULL AND vp.parichhed_no = hint_parichhed THEN parichhed_boost
            ELSE 0::float
          END
        + CASE
            WHEN hint_dafa_start IS NOT NULL
              AND hint_dafa_end IS NOT NULL
              AND extract_dafa_arabic(vp.dafa_no) BETWEEN hint_dafa_start AND hint_dafa_end
            THEN dafa_range_boost
            ELSE 0::float
          END
        + CASE
            WHEN hint_exact_dafas IS NOT NULL
              AND array_length(hint_exact_dafas, 1) > 0
              AND extract_dafa_arabic(vp.dafa_no) = ANY(hint_exact_dafas)
            THEN exact_dafa_boost
            WHEN hint_exact_dafa IS NOT NULL
              AND extract_dafa_arabic(vp.dafa_no) = hint_exact_dafa
            THEN exact_dafa_boost
            ELSE 0::float
          END
        + CASE
            WHEN tsq IS NOT NULL AND vp.search_vector @@ tsq THEN
              keyword_boost * least(1.0, (ts_rank_cd(vp.search_vector, tsq, 32)::float * 8.0))
            ELSE 0::float
          END
      )::float AS similarity
    FROM combined_pool vp
  )
  SELECT
    s.id,
    s.book_id,
    s.act_name,
    s.dafa_no,
    s.parichhed_no,
    s.content,
    s.filename,
    s.section_label,
    s.chapter,
    s.section_title,
    s.similarity
  FROM scored s
  ORDER BY s.similarity DESC
  LIMIT match_count;
END;
$$;
