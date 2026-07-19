-- =============================================================================
-- cheqii v2 — log compaction (sync-engine spec §8)
-- `mutation_logs` grows forever; periodically collapse a bill's history into a
-- single SNAPSHOT (full state at the max HLC) and truncate the older log rows.
-- Clients whose cursor predates the snapshot pull it and replace state wholesale.
-- SNAPSHOT is server-generated only (the /api/sync edge rejects it from clients).
-- =============================================================================

-- Build a bill's full state + write it as a SNAPSHOT log, then drop older logs.
-- SECURITY DEFINER + not granted to clients: a maintenance op (cron/service role).
create or replace function public.compact_bill(p_bill_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_payload  jsonb;
  v_hlc      text;
  v_owner    uuid;
  v_snap_seq bigint;
begin
  -- Nothing to compact if the bill has no logs (or no longer exists).
  select max(hlc) into v_hlc from mutation_logs where entity_id = p_bill_id;
  if v_hlc is null then
    return false;
  end if;

  -- A real uuid for the log's user_id (owner preferred, else any member).
  select user_id into v_owner from bill_users
    where bill_id = p_bill_id order by (role = 'owner') desc limit 1;
  if v_owner is null then
    return false;  -- ownerless/empty bill — leave it alone
  end if;

  -- Serialize the current materialized state (skip stubs / structurally-incomplete rows).
  select jsonb_build_object('bill', jsonb_build_object(
    'id', b.id, 'name', b.name, 'currency', b.currency, 'visibility', b.visibility,
    'tax', b.tax, 'tip', b.tip,
    'bill_contributors', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'sort', c.sort, 'linked_user_id', c.linked_user_id)), '[]'::jsonb)
      from bill_contributors c where c.bill_id = b.id and not c.is_stub),
    'bill_items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'contributor_id', i.contributor_id, 'name', i.name, 'cost', i.cost, 'sort', i.sort,
        'bill_item_splits', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'item_id', s.item_id, 'contributor_id', s.contributor_id, 'ratio', s.ratio)), '[]'::jsonb)
          from bill_item_splits s
          where s.item_id = i.id and not s.is_stub and s.contributor_id is not null))), '[]'::jsonb)
      from bill_items i where i.bill_id = b.id and not i.is_stub and i.contributor_id is not null),
    'bill_users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', bu.user_id, 'role', bu.role,
        'payment_id', bu.payment_id, 'payment_method', bu.payment_method)), '[]'::jsonb)
      from bill_users bu where bu.bill_id = b.id)
  )) into v_payload
  from bills b where b.id = p_bill_id;

  if v_payload is null then
    return false;  -- bill row gone
  end if;

  -- Append the SNAPSHOT (gets the highest seq_id), then truncate everything older.
  insert into mutation_logs (id, entity_id, type, payload, hlc, user_id, created_at)
  values (gen_random_uuid(), p_bill_id, 'SNAPSHOT', v_payload, v_hlc, v_owner, now())
  returning seq_id into v_snap_seq;

  delete from mutation_logs where entity_id = p_bill_id and seq_id < v_snap_seq;
  return true;
end;
$$;

-- Compact every bill whose log count exceeds the threshold; returns how many.
create or replace function public.compact_stale_bills(p_threshold int default 500)
returns int language plpgsql security definer set search_path = public as $$
declare v_bill uuid; v_count int := 0;
begin
  for v_bill in
    select entity_id from mutation_logs
    where entity_id in (select id from bills)         -- bill-scoped logs only
    group by entity_id having count(*) > p_threshold
  loop
    if compact_bill(v_bill) then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.compact_bill(uuid) from public;
revoke all on function public.compact_stale_bills(int) from public;

-- Schedule nightly compaction when pg_cron is available (Supabase). Safe no-op
-- otherwise. To run manually: select compact_stale_bills(500);
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('cheqii-compact-nightly', '0 3 * * *', 'select public.compact_stale_bills(500);');
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end $$;
