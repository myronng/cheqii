-- =============================================================================
-- cheqii v2 — rename the "contributor" domain noun to "person".
--
-- Forward-only migration applied ON TOP OF 20260627000001 (bill→cheque). We do
-- NOT edit historical files. No production data to preserve, but written to run
-- cleanly against the already-applied schema.
--
-- Strategy (same Postgres semantics as the bill→cheque rename):
--   * The table rename + column renames propagate to FK/PK/CHECK constraints, the
--     index, the realtime publication, and RLS policy *table/column* refs by OID.
--   * RLS policies on cheque_people call ONLY check_user_has_cheque_*/is_cheque_owner
--     (none of which are dropped here), so the policies hold no hard dependency on a
--     dropped function — no drop/recreate of policies needed; we only RENAME them
--     for cosmetic consistency.
--   * plpgsql/sql FUNCTION bodies are stored as TEXT, so every function whose body
--     (or name) references cheque_contributors / contributor_id / the renamed
--     _ensure_stub_* helper / the renamed wire payload keys is dropped and recreated
--     from its LATEST definition with all identifiers renamed.
--   * mutation_logs.type is plain text → one data UPDATE for the wire type strings.
--
-- Supabase runs each migration file in a single transaction.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Rename the table (FKs, PK, RLS policies, index, publication membership all
--    follow via OID; policy *names* keep cheque_contributors_* until renamed below).
-- ---------------------------------------------------------------------------
alter table public.cheque_contributors rename to cheque_people;

-- ---------------------------------------------------------------------------
-- 2. Rename the contributor_id FK columns on items + splits to person_id.
-- ---------------------------------------------------------------------------
alter table public.cheque_items       rename column contributor_id to person_id;
alter table public.cheque_item_splits rename column contributor_id to person_id;

-- ---------------------------------------------------------------------------
-- 3. Rename the index (cosmetic).
-- ---------------------------------------------------------------------------
alter index public.idx_cheque_contributors_cheque rename to idx_cheque_people_cheque;

-- ---------------------------------------------------------------------------
-- 4. Rename constraints (cosmetic; names don't follow ALTER TABLE/COLUMN RENAME).
-- ---------------------------------------------------------------------------
alter table public.cheque_people       rename constraint cheque_contributors_pkey                       to cheque_people_pkey;
alter table public.cheque_people       rename constraint cheque_contributors_cheque_id_fkey             to cheque_people_cheque_id_fkey;
alter table public.cheque_people       rename constraint cheque_contributors_linked_user_id_fkey        to cheque_people_linked_user_id_fkey;
alter table public.cheque_people       rename constraint cheque_contributors_name_len                   to cheque_people_name_len;
alter table public.cheque_items        rename constraint cheque_items_contributor_id_cheque_id_fkey      to cheque_items_person_id_cheque_id_fkey;
alter table public.cheque_item_splits  rename constraint cheque_item_splits_contributor_id_cheque_id_fkey to cheque_item_splits_person_id_cheque_id_fkey;

-- ---------------------------------------------------------------------------
-- 4b. Rename the ordered_cheque_splits view's OUTPUT columns. The view body
--     follows the table/column renames by OID, but a view's output column names
--     are fixed at creation, so the contributor_* aliases must be renamed
--     explicitly (same reason the bill→cheque migration renamed bill_id here).
-- ---------------------------------------------------------------------------
alter view public.ordered_cheque_splits rename column contributor_id         to person_id;
alter view public.ordered_cheque_splits rename column contributor_name        to person_name;
alter view public.ordered_cheque_splits rename column contributor_sort_order  to person_sort_order;

-- ---------------------------------------------------------------------------
-- 5. Rename the RLS policies (cosmetic; they reference only persisting helper
--    functions, so no drop/recreate is required).
-- ---------------------------------------------------------------------------
alter policy cheque_contributors_read   on public.cheque_people rename to cheque_people_read;
alter policy cheque_contributors_insert on public.cheque_people rename to cheque_people_insert;
alter policy cheque_contributors_update on public.cheque_people rename to cheque_people_update;
alter policy cheque_contributors_delete on public.cheque_people rename to cheque_people_delete;

-- ---------------------------------------------------------------------------
-- 6. Drop functions whose TEXT bodies (or names) reference renamed objects /
--    payload keys. Dropped by exact signature. plpgsql bodies hold no hard deps,
--    so order is free; recreation below restores them.
-- ---------------------------------------------------------------------------
drop function if exists public._ensure_stub_contributor(uuid, uuid);
drop function if exists public._upsert_split(uuid, uuid, uuid, uuid, int, text, timestamptz);
drop function if exists public.sync_create_cheque(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_add_contributor(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_update_contributor(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_delete_contributor(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_add_item(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_update_item(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_add_split(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.compact_cheque(uuid);

-- ---------------------------------------------------------------------------
-- 7. Recreate stub-ensure helper (renamed) + split upsert (person_id column).
-- ---------------------------------------------------------------------------
create function public._ensure_stub_person(p_cheque uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into cheque_people (cheque_id, id, is_stub) values (p_cheque, p_id, true) on conflict (cheque_id, id) do nothing;
$$;

create function public._upsert_split(
  p_id uuid, p_cheque uuid, p_item uuid, p_person uuid, p_ratio int, p_hlc text, p_created_at timestamptz
) returns void language sql security definer set search_path = public as $$
  insert into cheque_item_splits (id, cheque_id, item_id, person_id, ratio, hlc, col_hlc, is_stub, updated_at)
  values (p_id, p_cheque, p_item, p_person, p_ratio, p_hlc, jsonb_build_object('ratio', p_hlc), false, p_created_at)
  on conflict (id) do update set
    item_id    = coalesce(cheque_item_splits.item_id, excluded.item_id),               -- structural: fill once
    person_id  = coalesce(cheque_item_splits.person_id, excluded.person_id),
    ratio      = case when p_hlc > coalesce(cheque_item_splits.col_hlc->>'ratio','') then excluded.ratio else cheque_item_splits.ratio end,
    is_stub    = false,
    col_hlc    = cheque_item_splits.col_hlc || excluded.col_hlc,
    hlc        = greatest(cheque_item_splits.hlc, p_hlc),
    updated_at = greatest(cheque_item_splits.updated_at, p_created_at);
$$;

-- ---------------------------------------------------------------------------
-- 8. Recreate sync_create_cheque (cheque_people / person_id throughout, incl.
--    the nested JSON keys the client sends).
-- ---------------------------------------------------------------------------
create function public.sync_create_cheque(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_cheque jsonb := p_payload->'cheque';
  v_cheque_id uuid := (v_cheque->>'id')::uuid;
  v_c jsonb; v_i jsonb; v_s jsonb;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if exists (select 1 from cheques where id = v_cheque_id and not is_stub)
     and not is_cheque_owner(v_cheque_id, p_user_id) then
    raise exception 'unauthorized: cheque % already exists', v_cheque_id;
  end if;
  if not log_mutation(p_mutation_id, v_cheque_id, p_user_id, 'CREATE_CHEQUE', p_payload, p_hlc, p_created_at) then return; end if;

  insert into cheques (id, name, visibility, hlc, col_hlc, is_stub, updated_at)
  values (v_cheque_id, coalesce(v_cheque->>'name',''),
          coalesce((v_cheque->>'visibility')::cheque_visibility,'private'),
          p_hlc, jsonb_build_object('name',p_hlc,'visibility',p_hlc),
          false, p_created_at)
  on conflict (id) do update set
    name = case when p_hlc > coalesce(cheques.col_hlc->>'name','') then excluded.name else cheques.name end,
    visibility = case when p_hlc > coalesce(cheques.col_hlc->>'visibility','') then excluded.visibility else cheques.visibility end,
    is_stub = false,
    col_hlc = cheques.col_hlc || excluded.col_hlc,
    hlc = greatest(cheques.hlc, p_hlc),
    updated_at = greatest(cheques.updated_at, p_created_at);

  insert into cheque_users (cheque_id, user_id, role, hlc, updated_at)
  values (v_cheque_id, p_user_id, 'owner', p_hlc, p_created_at)
  on conflict (user_id, cheque_id) do nothing;

  for v_c in select * from jsonb_array_elements(coalesce(v_cheque->'cheque_people','[]'::jsonb)) loop
    insert into cheque_people (cheque_id, id, name, sort, linked_user_id, hlc, col_hlc, is_stub, updated_at)
    values (v_cheque_id, (v_c->>'id')::uuid, coalesce(v_c->>'name',''), coalesce((v_c->>'sort')::numeric,0),
            (v_c->>'linked_user_id')::uuid, p_hlc, jsonb_build_object('name',p_hlc,'sort',p_hlc), false, p_created_at)
    on conflict (cheque_id, id) do update set
      name = case when p_hlc > coalesce(cheque_people.col_hlc->>'name','') then excluded.name else cheque_people.name end,
      sort = case when p_hlc > coalesce(cheque_people.col_hlc->>'sort','') then excluded.sort else cheque_people.sort end,
      is_stub = false, col_hlc = cheque_people.col_hlc || excluded.col_hlc,
      hlc = greatest(cheque_people.hlc, p_hlc), updated_at = greatest(cheque_people.updated_at, p_created_at);
  end loop;

  for v_i in select * from jsonb_array_elements(coalesce(v_cheque->'cheque_items','[]'::jsonb)) loop
    insert into cheque_items (id, cheque_id, person_id, name, cost, sort, hlc, col_hlc, is_stub, updated_at)
    values ((v_i->>'id')::uuid, v_cheque_id, (v_i->>'person_id')::uuid, coalesce(v_i->>'name',''),
            coalesce((v_i->>'cost')::bigint,0), coalesce((v_i->>'sort')::numeric,0), p_hlc,
            jsonb_build_object('name',p_hlc,'cost',p_hlc,'person_id',p_hlc,'sort',p_hlc), false, p_created_at)
    on conflict (id) do nothing;
    for v_s in select * from jsonb_array_elements(coalesce(v_i->'cheque_item_splits','[]'::jsonb)) loop
      perform _upsert_split((v_s->>'id')::uuid, v_cheque_id, (v_i->>'id')::uuid, (v_s->>'person_id')::uuid, coalesce((v_s->>'ratio')::int,0), p_hlc, p_created_at);
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Recreate the person RPCs (was contributor): sync_add/update/delete_person.
-- ---------------------------------------------------------------------------
create function public.sync_add_person(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_c jsonb := p_payload->'person'; v_s jsonb;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'ADD_PERSON', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_cheque(p_entity_id);
  insert into cheque_people (cheque_id, id, name, sort, linked_user_id, hlc, col_hlc, is_stub, updated_at)
  values (p_entity_id, (v_c->>'id')::uuid, coalesce(v_c->>'name',''), coalesce((v_c->>'sort')::numeric,0),
          (v_c->>'linked_user_id')::uuid, p_hlc, jsonb_build_object('name',p_hlc,'sort',p_hlc), false, p_created_at)
  on conflict (cheque_id, id) do update set
    name = case when p_hlc > coalesce(cheque_people.col_hlc->>'name','') then excluded.name else cheque_people.name end,
    sort = case when p_hlc > coalesce(cheque_people.col_hlc->>'sort','') then excluded.sort else cheque_people.sort end,
    is_stub = false, col_hlc = cheque_people.col_hlc || excluded.col_hlc,
    hlc = greatest(cheque_people.hlc, p_hlc), updated_at = greatest(cheque_people.updated_at, p_created_at);
  for v_s in select * from jsonb_array_elements(coalesce(p_payload->'splits','[]'::jsonb)) loop
    perform _ensure_stub_item(p_entity_id, (v_s->>'item_id')::uuid);
    perform _upsert_split((v_s->>'id')::uuid, p_entity_id, (v_s->>'item_id')::uuid, (v_s->>'person_id')::uuid, coalesce((v_s->>'ratio')::int,0), p_hlc, p_created_at);
  end loop;
end;
$$;

create function public.sync_update_person(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid := (p_payload->>'id')::uuid;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if p_payload ? 'linked_user_id' and (p_payload->>'linked_user_id')::uuid <> p_user_id then
    raise exception 'unauthorized: can only link your own account';
  end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_PERSON', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_cheque(p_entity_id);
  perform _ensure_stub_person(p_entity_id, v_id);
  update cheque_people set
    name = case when p_payload ? 'name' and p_hlc > coalesce(col_hlc->>'name','') then p_payload->>'name' else name end,
    sort = case when p_payload ? 'sort' and p_hlc > coalesce(col_hlc->>'sort','') then (p_payload->>'sort')::numeric else sort end,
    linked_user_id = case when p_payload ? 'linked_user_id' and p_hlc > coalesce(col_hlc->>'linked_user_id','') then (p_payload->>'linked_user_id')::uuid else linked_user_id end,
    col_hlc = col_hlc
      || (case when p_payload ? 'name' and p_hlc > coalesce(col_hlc->>'name','') then jsonb_build_object('name',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'sort' and p_hlc > coalesce(col_hlc->>'sort','') then jsonb_build_object('sort',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'linked_user_id' and p_hlc > coalesce(col_hlc->>'linked_user_id','') then jsonb_build_object('linked_user_id',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where cheque_id = p_entity_id and id = v_id;
end;
$$;

create function public.sync_delete_person(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_pid uuid := (p_payload->>'personId')::uuid; v_reassign uuid := (p_payload->>'reassignToId')::uuid;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_PERSON', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_person(p_entity_id, v_reassign);
  update cheque_items set person_id = v_reassign where cheque_id = p_entity_id and person_id = v_pid;
  delete from cheque_item_splits where cheque_id = p_entity_id and person_id = v_pid;
  delete from cheque_people where cheque_id = p_entity_id and id = v_pid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Recreate item RPCs that touch person_id / _ensure_stub_person.
-- ---------------------------------------------------------------------------
create function public.sync_add_item(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_i jsonb := p_payload->'item'; v_s jsonb;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'ADD_ITEM', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_cheque(p_entity_id);
  perform _ensure_stub_person(p_entity_id, (v_i->>'person_id')::uuid);
  insert into cheque_items (id, cheque_id, person_id, name, cost, sort, hlc, col_hlc, is_stub, updated_at)
  values ((v_i->>'id')::uuid, p_entity_id, (v_i->>'person_id')::uuid, coalesce(v_i->>'name',''),
          coalesce((v_i->>'cost')::bigint,0), coalesce((v_i->>'sort')::numeric,0), p_hlc,
          jsonb_build_object('name',p_hlc,'cost',p_hlc,'person_id',p_hlc,'sort',p_hlc), false, p_created_at)
  on conflict (id) do update set
    person_id = case when p_hlc > coalesce(cheque_items.col_hlc->>'person_id','') then excluded.person_id else cheque_items.person_id end,
    name = case when p_hlc > coalesce(cheque_items.col_hlc->>'name','') then excluded.name else cheque_items.name end,
    cost = case when p_hlc > coalesce(cheque_items.col_hlc->>'cost','') then excluded.cost else cheque_items.cost end,
    sort = case when p_hlc > coalesce(cheque_items.col_hlc->>'sort','') then excluded.sort else cheque_items.sort end,
    is_stub = false, col_hlc = cheque_items.col_hlc || excluded.col_hlc,
    hlc = greatest(cheque_items.hlc, p_hlc), updated_at = greatest(cheque_items.updated_at, p_created_at);
  for v_s in select * from jsonb_array_elements(coalesce(p_payload->'splits','[]'::jsonb)) loop
    perform _upsert_split((v_s->>'id')::uuid, p_entity_id, (v_i->>'id')::uuid, (v_s->>'person_id')::uuid, coalesce((v_s->>'ratio')::int,0), p_hlc, p_created_at);
  end loop;
end;
$$;

create function public.sync_update_item(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid := (p_payload->>'id')::uuid;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_ITEM', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_cheque(p_entity_id);
  perform _ensure_stub_item(p_entity_id, v_id);
  if p_payload ? 'person_id' then perform _ensure_stub_person(p_entity_id, (p_payload->>'person_id')::uuid); end if;
  update cheque_items set
    name = case when p_payload ? 'name' and p_hlc > coalesce(col_hlc->>'name','') then p_payload->>'name' else name end,
    cost = case when p_payload ? 'cost' and p_hlc > coalesce(col_hlc->>'cost','') then (p_payload->>'cost')::bigint else cost end,
    person_id = case when p_payload ? 'person_id' and p_hlc > coalesce(col_hlc->>'person_id','') then (p_payload->>'person_id')::uuid else person_id end,
    sort = case when p_payload ? 'sort' and p_hlc > coalesce(col_hlc->>'sort','') then (p_payload->>'sort')::numeric else sort end,
    col_hlc = col_hlc
      || (case when p_payload ? 'name' and p_hlc > coalesce(col_hlc->>'name','') then jsonb_build_object('name',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'cost' and p_hlc > coalesce(col_hlc->>'cost','') then jsonb_build_object('cost',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'person_id' and p_hlc > coalesce(col_hlc->>'person_id','') then jsonb_build_object('person_id',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'sort' and p_hlc > coalesce(col_hlc->>'sort','') then jsonb_build_object('sort',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where id = v_id and cheque_id = p_entity_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Recreate sync_add_split (touches person_id / _ensure_stub_person).
--     sync_update_split only touches ratio → not recreated.
-- ---------------------------------------------------------------------------
create function public.sync_add_split(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'ADD_SPLIT', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_cheque(p_entity_id);
  perform _ensure_stub_item(p_entity_id, (p_payload->>'item_id')::uuid);
  perform _ensure_stub_person(p_entity_id, (p_payload->>'person_id')::uuid);
  perform _upsert_split((p_payload->>'id')::uuid, p_entity_id, (p_payload->>'item_id')::uuid, (p_payload->>'person_id')::uuid, coalesce((p_payload->>'ratio')::int,0), p_hlc, p_created_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Recreate compact_cheque (snapshot body references cheque_people / person_id
--     + emits the renamed JSON keys). compact_stale_cheques calls it via plpgsql
--     (soft dep) and references no renamed object → left intact.
-- ---------------------------------------------------------------------------
create function public.compact_cheque(p_cheque_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_payload  jsonb;
  v_hlc      text;
  v_owner    uuid;
  v_snap_seq bigint;
begin
  select max(hlc) into v_hlc from mutation_logs where entity_id = p_cheque_id;
  if v_hlc is null then
    return false;
  end if;

  select user_id into v_owner from cheque_users
    where cheque_id = p_cheque_id order by (role = 'owner') desc limit 1;
  if v_owner is null then
    return false;
  end if;

  select jsonb_build_object('cheque', jsonb_build_object(
    'id', b.id, 'name', b.name, 'visibility', b.visibility,
    'cheque_people', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'sort', c.sort, 'linked_user_id', c.linked_user_id)), '[]'::jsonb)
      from cheque_people c where c.cheque_id = b.id and not c.is_stub),
    'cheque_items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'person_id', i.person_id, 'name', i.name, 'cost', i.cost, 'sort', i.sort,
        'cheque_item_splits', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'item_id', s.item_id, 'person_id', s.person_id, 'ratio', s.ratio)), '[]'::jsonb)
          from cheque_item_splits s
          where s.item_id = i.id and not s.is_stub and s.person_id is not null))), '[]'::jsonb)
      from cheque_items i where i.cheque_id = b.id and not i.is_stub and i.person_id is not null),
    'cheque_users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', bu.user_id, 'role', bu.role,
        'payment_id', bu.payment_id, 'payment_method', bu.payment_method)), '[]'::jsonb)
      from cheque_users bu where bu.cheque_id = b.id)
  )) into v_payload
  from cheques b where b.id = p_cheque_id;

  if v_payload is null then
    return false;
  end if;

  insert into mutation_logs (id, entity_id, type, payload, hlc, user_id, created_at)
  values (gen_random_uuid(), p_cheque_id, 'SNAPSHOT', v_payload, v_hlc, v_owner, now())
  returning seq_id into v_snap_seq;

  delete from mutation_logs where entity_id = p_cheque_id and seq_id < v_snap_seq;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Re-apply SECURITY DEFINER lockdown for the recreated internal functions
--     (CREATE re-adds Supabase's default anon/authenticated EXECUTE grants).
--     The sync_* RPCs keep the default PUBLIC execute grant (self-guarded);
--     they are recreated the same way the bill→cheque migration left them.
-- ---------------------------------------------------------------------------
revoke all on function public._ensure_stub_person(uuid, uuid)                         from public, anon, authenticated;
revoke all on function public._upsert_split(uuid, uuid, uuid, uuid, int, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.compact_cheque(uuid)                                    from public, anon, authenticated;
grant execute on function public.compact_cheque(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 14. Rewrite the wire mutation-type strings stored in mutation_logs.type.
--     ADD_CONTRIBUTOR->ADD_PERSON, UPDATE_CONTRIBUTOR->UPDATE_PERSON,
--     DELETE_CONTRIBUTOR->DELETE_PERSON. No other type string contains
--     'CONTRIBUTOR'.
-- ---------------------------------------------------------------------------
update public.mutation_logs set type = replace(type, 'CONTRIBUTOR', 'PERSON') where type like '%CONTRIBUTOR%';
