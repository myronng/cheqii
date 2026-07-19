-- =============================================================================
-- cheqii v2 — Realtime liveness (sync-engine spec §4)
-- The sync engine subscribes to postgres_changes on mutation_logs so an idle
-- device pulls as soon as a peer appends a mutation. That requires the table to
-- be in the `supabase_realtime` publication; Realtime then RLS-scopes events to
-- what each subscriber may read. Idempotent + guarded so apply never fails.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mutation_logs'
     )
  then
    alter publication supabase_realtime add table public.mutation_logs;
  end if;
end $$;
