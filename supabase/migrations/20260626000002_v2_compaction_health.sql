-- =============================================================================
-- cheqii v2 — compaction-health observability + SECURITY DEFINER lockdown (ops).
--
-- `compaction_health()` returns mutation-log growth stats for monitoring, and
-- `compact_stale_bills` logs a structured line per run.
--
-- SECURITY FIX: Supabase default-grants EXECUTE on public functions to anon +
-- authenticated, so the existing `revoke ... from public` left maintenance and
-- internal helper functions DIRECTLY callable by any (even anonymous) client —
-- e.g. anon could call compact_bill(<any bill>) (force-snapshot + delete logs) or
-- log_mutation()/_upsert_split() (inject rows). These are only ever called inside
-- SECURITY DEFINER functions (which run as the owner), so revoking caller EXECUTE
-- does not affect internal calls. Lock them to the owner/service_role only.
-- =============================================================================

create or replace function public.compaction_health(p_threshold int default 500)
returns jsonb language sql security definer set search_path = public stable as $$
  with per_entity as (
    select entity_id, count(*) as c from public.mutation_logs group by entity_id
  )
  select jsonb_build_object(
    'total_logs',          (select count(*) from public.mutation_logs),
    'snapshots',           (select count(*) from public.mutation_logs where type = 'SNAPSHOT'),
    'entities_with_logs',  (select count(*) from per_entity),
    'max_logs_per_entity', (select coalesce(max(c), 0) from per_entity),
    'entities_over_threshold', (select count(*) from per_entity where c > p_threshold),
    'threshold',           p_threshold,
    'oldest_log',          (select min(created_at) from public.mutation_logs)
  );
$$;

-- Re-create compact_stale_bills to log a structured summary line per run.
create or replace function public.compact_stale_bills(p_threshold int default 500)
returns int language plpgsql security definer set search_path = public as $$
declare v_bill uuid; v_count int := 0; v_candidates int := 0;
begin
  for v_bill in
    select entity_id from mutation_logs
    where entity_id in (select id from bills)         -- bill-scoped logs only
    group by entity_id having count(*) > p_threshold
  loop
    v_candidates := v_candidates + 1;
    if compact_bill(v_bill) then v_count := v_count + 1; end if;
  end loop;
  raise log 'cheqii.compaction: compacted % of % candidate bills (threshold %)',
    v_count, v_candidates, p_threshold;
  return v_count;
end;
$$;

-- ---- lockdown: revoke direct caller EXECUTE on maintenance + internal helpers --
-- `from public` removes the PUBLIC grant; `from anon, authenticated` removes the
-- direct grants Supabase's default privileges add at CREATE time.
revoke all on function public.compact_bill(uuid)                  from public, anon, authenticated;
revoke all on function public.compact_stale_bills(int)           from public, anon, authenticated;
revoke all on function public.compaction_health(int)             from public, anon, authenticated;
revoke all on function public.log_mutation(uuid, uuid, uuid, text, jsonb, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public._upsert_split(uuid, uuid, uuid, uuid, int, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public._ensure_stub_bill(uuid)            from public, anon, authenticated;
revoke all on function public._ensure_stub_contributor(uuid, uuid) from public, anon, authenticated;
revoke all on function public._ensure_stub_item(uuid, uuid)      from public, anon, authenticated;
revoke all on function public._bill_role_rank(public.bill_role)  from public, anon, authenticated;
revoke all on function public.handle_new_user()                  from public, anon, authenticated;

-- Maintenance functions stay callable by the service role (cron / monitoring).
grant execute on function public.compact_bill(uuid)        to service_role;
grant execute on function public.compact_stale_bills(int)  to service_role;
grant execute on function public.compaction_health(int)    to service_role;
