-- Extended chunk metadata for structured legal indexing
-- Run in Supabase SQL editor after schema.sql

alter table documents add column if not exists document_category text;
alter table documents add column if not exists indexing_rule_id text;

alter table chunks add column if not exists chunk_id text;
alter table chunks add column if not exists part text;
alter table chunks add column if not exists subsection_label text;
alter table chunks add column if not exists clause_label text;
alter table chunks add column if not exists metadata jsonb;

create index if not exists chunks_chunk_id_idx on chunks (chunk_id);
create index if not exists chunks_metadata_gin_idx on chunks using gin (metadata);
create index if not exists documents_indexing_rule_idx on documents (indexing_rule_id);
