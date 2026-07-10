-- Full-text search on chunks (replaces ilike keyword scan)
-- Run in Supabase SQL editor or: npx tsx scripts/apply-fts-migration.ts
--
-- Uses 'simple' config (no English stemming) — works for Devanagari + digits.
-- apply-fts-migration.ts raises maintenance_work_mem before running this file.

alter table chunks add column if not exists search_vector tsvector;

-- Backfill + keep in sync via generated column (Postgres 12+)
-- Drop plain column if re-running after failed partial migration:
-- alter table chunks drop column if exists search_vector;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'chunks'
      and column_name = 'search_vector'
      and is_generated = 'ALWAYS'
  ) then
    alter table chunks drop column if exists search_vector;
    alter table chunks add column search_vector tsvector
      generated always as (
        setweight(to_tsvector('simple', coalesce(content, '')), 'A')
        || setweight(to_tsvector('simple', coalesce(section_title, '')), 'B')
        || setweight(to_tsvector('simple', coalesce(section_label, '')), 'C')
        || setweight(to_tsvector('simple', coalesce(chapter, '')), 'D')
      ) stored;
  end if;
end $$;

create index if not exists chunks_search_vector_gin_idx
  on chunks using gin (search_vector);

drop function if exists search_chunks_fts(text, integer, text);

create or replace function search_chunks_fts(
  search_query text,
  match_count int default 8,
  search_mode text default 'plain'
)
returns table (
  id uuid,
  content text,
  filename text,
  page_number int,
  section_label text,
  chapter text,
  similarity float
)
language plpgsql stable as $$
declare
  tsq tsquery;
  cleaned text;
  parts text[];
  or_clause text;
begin
  cleaned := trim(regexp_replace(coalesce(search_query, ''), '[^\w\u0900-\u097F\s]', ' ', 'g'));
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');

  if cleaned = '' then
    return;
  end if;

  if search_mode = 'or' then
    parts := regexp_split_to_array(cleaned, '\s+');
    select string_agg(part, ' | ')
    into or_clause
    from unnest(parts) as part
    where length(part) > 1;

    if or_clause is null or or_clause = '' then
      return;
    end if;

    tsq := to_tsquery('simple', or_clause);
  else
    tsq := plainto_tsquery('simple', cleaned);
  end if;

  if tsq is null then
    return;
  end if;

  return query
  select
    c.id,
    c.content,
    d.filename,
    c.page_number,
    c.section_label,
    c.chapter,
    least(1.0, (ts_rank_cd(c.search_vector, tsq, 32)::float * 8.0))::float as similarity
  from chunks c
  join documents d on d.id = c.document_id
  where c.search_vector @@ tsq
  order by similarity desc
  limit match_count;
end;
$$;
