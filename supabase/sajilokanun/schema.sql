-- Enable pgvector extension (run once in Supabase SQL editor)
create extension if not exists vector;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null unique,
  title text not null,
  created_at timestamptz default now()
);

create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  embedding vector(768),
  page_number int,
  chunk_index int,
  section_label text,
  chapter text,
  section_title text,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(content, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(section_title, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(section_label, '')), 'C')
    || setweight(to_tsvector('simple', coalesce(chapter, '')), 'D')
  ) stored,
  created_at timestamptz default now()
);

set maintenance_work_mem = '128MB';

create index if not exists chunks_search_vector_gin_idx
  on chunks using gin (search_vector);

reset maintenance_work_mem;

-- Run after ingestion when chunks table has data
-- create index if not exists chunks_embedding_idx on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

drop function if exists match_chunks(vector, integer);

create or replace function match_chunks(
  query_embedding vector(768),
  match_count int default 8
)
returns table (id uuid, content text, filename text, page_number int, section_label text, chapter text, similarity float)
language sql stable as $$
  select c.id, c.content, d.filename, c.page_number, c.section_label, c.chapter,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

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
