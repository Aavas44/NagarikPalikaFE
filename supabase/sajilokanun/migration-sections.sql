-- Run in Supabase SQL editor (after initial schema)
alter table chunks add column if not exists section_label text;
alter table chunks add column if not exists chapter text;
alter table chunks add column if not exists section_title text;

-- Required when return columns change (Postgres cannot CREATE OR REPLACE with new OUT params)
drop function if exists match_chunks(vector, integer);

create or replace function match_chunks(
  query_embedding vector(768),
  match_count int default 8
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
language sql stable as $$
  select c.id, c.content, d.filename, c.page_number, c.section_label, c.chapter,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
