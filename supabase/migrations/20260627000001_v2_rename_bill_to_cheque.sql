-- =============================================================================
-- cheqii v2 — rename the "bill" domain to "cheque".
--
-- Forward-only migration applied ON TOP OF the existing v2 migrations. We do NOT
-- edit any historical file. There is no production data to preserve, but this is
-- written to run cleanly against the already-applied schema.
--
-- Strategy (relies on Postgres semantics):
--   * FK constraints, the realtime publication membership, and the view *body*
--     store their references as parsed OIDs, so ALTER ... RENAME on
--     types/tables/columns propagates to them automatically — no drop/recreate.
--   * RLS policy *table/column* references also follow renames by OID, BUT a
--     policy that CALLS a function holds a hard dependency on that function — so
--     the access-helper functions cannot be dropped while the policies exist.
--     We therefore DROP the dependent policies first, then drop+recreate the
--     functions under their new names, then recreate the policies bound to the
--     new function names. (Policy *names* keep their original bill_* spelling
--     until recreated below.)
--   * plpgsql/sql FUNCTION bodies are stored as TEXT, so renames do NOT update
--     them. Every function whose body (or name) references a renamed
--     table/column/type/function is dropped and recreated from its LATEST
--     definition with all identifiers renamed.
--   * mutation_logs.type is a plain text column (no CHECK / no enum), so a single
--     data UPDATE suffices for the wire mutation-type strings.
--
-- Supabase runs each migration file in a single transaction.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Rename enum types (propagates to all columns/params/functions-by-OID;
--    function *bodies* that name the type by text are recreated below).
-- ---------------------------------------------------------------------------
alter type public.bill_role       rename to cheque_role;
alter type public.bill_visibility rename to cheque_visibility;

-- ---------------------------------------------------------------------------
-- 2. Rename tables (FKs, PKs, RLS policies, triggers, publication membership,
--    and the view body follow automatically via OIDs).
-- ---------------------------------------------------------------------------
alter table public.bills             rename to cheques;
alter table public.bill_users        rename to cheque_users;
alter table public.bill_items        rename to cheque_items;
alter table public.bill_contributors rename to cheque_contributors;
alter table public.bill_item_splits  rename to cheque_item_splits;

-- ---------------------------------------------------------------------------
-- 3. Rename every bill_id column to cheque_id.
-- ---------------------------------------------------------------------------
alter table public.cheque_users        rename column bill_id to cheque_id;
alter table public.cheque_items        rename column bill_id to cheque_id;
alter table public.cheque_contributors rename column bill_id to cheque_id;
alter table public.cheque_item_splits  rename column bill_id to cheque_id;
alter table public.invites             rename column bill_id to cheque_id;

-- ---------------------------------------------------------------------------
-- 4. Rename indexes (cosmetic; idx_bill_* -> idx_cheque_*).
-- ---------------------------------------------------------------------------
alter index public.idx_bill_users_bill        rename to idx_cheque_users_cheque;
alter index public.idx_bill_contributors_bill rename to idx_cheque_contributors_cheque;
alter index public.idx_bill_items_bill        rename to idx_cheque_items_cheque;
alter index public.idx_bill_item_splits_bill  rename to idx_cheque_item_splits_cheque;
alter index public.idx_bill_item_splits_item  rename to idx_cheque_item_splits_item;
alter index public.idx_invites_bill           rename to idx_invites_cheque;

-- ---------------------------------------------------------------------------
-- 5. Rename the view (its body's column/table refs follow the table renames).
--    A view's OUTPUT column names are fixed at creation, so the explicit
--    `cheque_id AS bill_id` alias must be renamed too.
-- ---------------------------------------------------------------------------
alter view public.ordered_bill_splits rename to ordered_cheque_splits;
alter view public.ordered_cheque_splits rename column bill_id to cheque_id;

-- ---------------------------------------------------------------------------
-- 5b. Rename constraints (cosmetic; PK/FK/CHECK names don't follow ALTER TABLE
--     RENAME). Keeps the schema labels consistent with the new domain.
-- ---------------------------------------------------------------------------
alter table public.cheques              rename constraint bills_pkey to cheques_pkey;
alter table public.cheques              rename constraint bills_name_len to cheques_name_len;
alter table public.cheque_users         rename constraint bill_users_pkey to cheque_users_pkey;
alter table public.cheque_users         rename constraint bill_users_bill_id_fkey to cheque_users_cheque_id_fkey;
alter table public.cheque_users         rename constraint bill_users_user_id_fkey to cheque_users_user_id_fkey;
alter table public.cheque_users         rename constraint bill_users_payment_id_len to cheque_users_payment_id_len;
alter table public.cheque_contributors  rename constraint bill_contributors_pkey to cheque_contributors_pkey;
alter table public.cheque_contributors  rename constraint bill_contributors_bill_id_fkey to cheque_contributors_cheque_id_fkey;
alter table public.cheque_contributors  rename constraint bill_contributors_linked_user_id_fkey to cheque_contributors_linked_user_id_fkey;
alter table public.cheque_contributors  rename constraint bill_contributors_name_len to cheque_contributors_name_len;
alter table public.cheque_items         rename constraint bill_items_pkey to cheque_items_pkey;
alter table public.cheque_items         rename constraint bill_items_bill_id_fkey to cheque_items_cheque_id_fkey;
alter table public.cheque_items         rename constraint bill_items_contributor_id_bill_id_fkey to cheque_items_contributor_id_cheque_id_fkey;
alter table public.cheque_items         rename constraint bill_items_cost_range to cheque_items_cost_range;
alter table public.cheque_items         rename constraint bill_items_name_len to cheque_items_name_len;
alter table public.cheque_item_splits   rename constraint bill_item_splits_pkey to cheque_item_splits_pkey;
alter table public.cheque_item_splits   rename constraint bill_item_splits_bill_id_fkey to cheque_item_splits_cheque_id_fkey;
alter table public.cheque_item_splits   rename constraint bill_item_splits_item_id_fkey to cheque_item_splits_item_id_fkey;
alter table public.cheque_item_splits   rename constraint bill_item_splits_contributor_id_bill_id_fkey to cheque_item_splits_contributor_id_cheque_id_fkey;
alter table public.cheque_item_splits   rename constraint bill_item_splits_ratio_range to cheque_item_splits_ratio_range;
alter table public.invites              rename constraint invites_bill_id_fkey to invites_cheque_id_fkey;

-- ---------------------------------------------------------------------------
-- 6a. Drop RLS policies that CALL the access-helper functions. A policy holds a
--     hard dependency on any function it invokes, so these must go before the
--     helpers can be dropped. (Their table/column refs already followed the
--     renames via OID; we only drop them because of the function dependency.)
--     The mutation_logs and users policies call no helper function and use only
--     OID-bound table/column refs, so they are left intact.
-- ---------------------------------------------------------------------------
drop policy if exists bills_read   on public.cheques;
drop policy if exists bills_insert on public.cheques;
drop policy if exists bills_update on public.cheques;
drop policy if exists bills_delete on public.cheques;

drop policy if exists bill_users_read   on public.cheque_users;
drop policy if exists bill_users_insert on public.cheque_users;
drop policy if exists bill_users_update on public.cheque_users;
drop policy if exists bill_users_delete on public.cheque_users;

drop policy if exists bill_contributors_read   on public.cheque_contributors;
drop policy if exists bill_contributors_insert on public.cheque_contributors;
drop policy if exists bill_contributors_update on public.cheque_contributors;
drop policy if exists bill_contributors_delete on public.cheque_contributors;

drop policy if exists bill_items_read   on public.cheque_items;
drop policy if exists bill_items_insert on public.cheque_items;
drop policy if exists bill_items_update on public.cheque_items;
drop policy if exists bill_items_delete on public.cheque_items;

drop policy if exists bill_item_splits_read   on public.cheque_item_splits;
drop policy if exists bill_item_splits_insert on public.cheque_item_splits;
drop policy if exists bill_item_splits_update on public.cheque_item_splits;
drop policy if exists bill_item_splits_delete on public.cheque_item_splits;

drop policy if exists invites_owner_read   on public.invites;
drop policy if exists invites_owner_insert on public.invites;
drop policy if exists invites_owner_update on public.invites;
drop policy if exists invites_owner_delete on public.invites;

-- ---------------------------------------------------------------------------
-- 6b. Drop old functions (text bodies reference renamed objects). Dropped by
--    exact signature. Order: dependents do not need to precede dependencies
--    because we drop with the existing names; recreation below restores them.
-- ---------------------------------------------------------------------------
drop function if exists public.check_user_has_bill_read_access(uuid, uuid);
drop function if exists public.check_user_has_bill_write_access(uuid, uuid);
drop function if exists public.is_bill_owner(uuid, uuid);

drop function if exists public._ensure_stub_bill(uuid);
drop function if exists public._ensure_stub_contributor(uuid, uuid);
drop function if exists public._ensure_stub_item(uuid, uuid);
drop function if exists public._upsert_split(uuid, uuid, uuid, uuid, int, text, timestamptz);

drop function if exists public.sync_create_bill(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_update_bill(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_delete_bill(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_add_contributor(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_update_contributor(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_delete_contributor(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_add_item(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_update_item(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_delete_item(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_add_split(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_update_split(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_update_bill_user(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_delete_bill_user(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_update_user(uuid, uuid, text, timestamptz, uuid, jsonb);
drop function if exists public.sync_delete_user(uuid, uuid, text, timestamptz, uuid, jsonb);

-- join_bill_via_invite calls _bill_role_rank; drop the caller first (plpgsql bodies
-- don't create hard deps, but explicit order keeps this robust).
drop function if exists public.join_bill_via_invite(uuid, uuid, uuid);
drop function if exists public._bill_role_rank(public.cheque_role);   -- type already renamed above

drop function if exists public.compact_bill(uuid);
drop function if exists public.compact_stale_bills(int);

-- ---------------------------------------------------------------------------
-- 7. Recreate access helpers (SECURITY DEFINER, recursion-safe). Names renamed
--    (they contained "bill"); bodies reference renamed tables/columns.
-- ---------------------------------------------------------------------------
create function public.check_user_has_cheque_read_access(p_cheque_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public stable as $$
begin
  -- stub cheques are invisible to everyone but the system
  if exists (select 1 from cheques where id = p_cheque_id and is_stub) then
    return false;
  end if;
  return exists (
    select 1 from cheque_users where cheque_id = p_cheque_id and user_id = p_user_id
  ) or exists (
    select 1 from cheques where id = p_cheque_id and visibility = 'public_read'
  );
end;
$$;

create function public.check_user_has_cheque_write_access(p_cheque_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public stable as $$
begin
  if exists (select 1 from cheques where id = p_cheque_id and is_stub) then
    return false;
  end if;
  -- editors and owners only; NO visibility / owner-absence bypass
  return exists (
    select 1 from cheque_users
    where cheque_id = p_cheque_id and user_id = p_user_id and role in ('owner', 'editor')
  );
end;
$$;

create function public.is_cheque_owner(p_cheque_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public stable as $$
begin
  return exists (
    select 1 from cheque_users
    where cheque_id = p_cheque_id and user_id = p_user_id and role = 'owner'
  );
end;
$$;

grant execute on function public.check_user_has_cheque_read_access(uuid, uuid)  to authenticated;
grant execute on function public.check_user_has_cheque_write_access(uuid, uuid) to authenticated;
grant execute on function public.is_cheque_owner(uuid, uuid)                    to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Recreate stub-ensure helpers + split upsert.
-- ---------------------------------------------------------------------------
create function public._ensure_stub_cheque(p_cheque uuid)
returns void language sql security definer set search_path = public as $$
  insert into cheques (id, is_stub) values (p_cheque, true) on conflict (id) do nothing;
$$;

create function public._ensure_stub_contributor(p_cheque uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into cheque_contributors (cheque_id, id, is_stub) values (p_cheque, p_id, true) on conflict (cheque_id, id) do nothing;
$$;

create function public._ensure_stub_item(p_cheque uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into cheque_items (id, cheque_id, is_stub) values (p_id, p_cheque, true) on conflict (id) do nothing;
$$;

create function public._upsert_split(
  p_id uuid, p_cheque uuid, p_item uuid, p_contrib uuid, p_ratio int, p_hlc text, p_created_at timestamptz
) returns void language sql security definer set search_path = public as $$
  insert into cheque_item_splits (id, cheque_id, item_id, contributor_id, ratio, hlc, col_hlc, is_stub, updated_at)
  values (p_id, p_cheque, p_item, p_contrib, p_ratio, p_hlc, jsonb_build_object('ratio', p_hlc), false, p_created_at)
  on conflict (id) do update set
    item_id        = coalesce(cheque_item_splits.item_id, excluded.item_id),               -- structural: fill once
    contributor_id = coalesce(cheque_item_splits.contributor_id, excluded.contributor_id),
    ratio          = case when p_hlc > coalesce(cheque_item_splits.col_hlc->>'ratio','') then excluded.ratio else cheque_item_splits.ratio end,
    is_stub        = false,
    col_hlc        = cheque_item_splits.col_hlc || excluded.col_hlc,
    hlc            = greatest(cheque_item_splits.hlc, p_hlc),
    updated_at     = greatest(cheque_item_splits.updated_at, p_created_at);
$$;

-- ---------------------------------------------------------------------------
-- 9. Recreate sync_* RPCs (LATEST bodies from 20260626000003, with the
--    auth-guard preserved; cheque-renamed throughout).
-- =====================  CHEQUE  ============================================
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

  for v_c in select * from jsonb_array_elements(coalesce(v_cheque->'cheque_contributors','[]'::jsonb)) loop
    insert into cheque_contributors (cheque_id, id, name, sort, linked_user_id, hlc, col_hlc, is_stub, updated_at)
    values (v_cheque_id, (v_c->>'id')::uuid, coalesce(v_c->>'name',''), coalesce((v_c->>'sort')::numeric,0),
            (v_c->>'linked_user_id')::uuid, p_hlc, jsonb_build_object('name',p_hlc,'sort',p_hlc), false, p_created_at)
    on conflict (cheque_id, id) do update set
      name = case when p_hlc > coalesce(cheque_contributors.col_hlc->>'name','') then excluded.name else cheque_contributors.name end,
      sort = case when p_hlc > coalesce(cheque_contributors.col_hlc->>'sort','') then excluded.sort else cheque_contributors.sort end,
      is_stub = false, col_hlc = cheque_contributors.col_hlc || excluded.col_hlc,
      hlc = greatest(cheque_contributors.hlc, p_hlc), updated_at = greatest(cheque_contributors.updated_at, p_created_at);
  end loop;

  for v_i in select * from jsonb_array_elements(coalesce(v_cheque->'cheque_items','[]'::jsonb)) loop
    insert into cheque_items (id, cheque_id, contributor_id, name, cost, sort, hlc, col_hlc, is_stub, updated_at)
    values ((v_i->>'id')::uuid, v_cheque_id, (v_i->>'contributor_id')::uuid, coalesce(v_i->>'name',''),
            coalesce((v_i->>'cost')::bigint,0), coalesce((v_i->>'sort')::numeric,0), p_hlc,
            jsonb_build_object('name',p_hlc,'cost',p_hlc,'contributor_id',p_hlc,'sort',p_hlc), false, p_created_at)
    on conflict (id) do nothing;
    for v_s in select * from jsonb_array_elements(coalesce(v_i->'cheque_item_splits','[]'::jsonb)) loop
      perform _upsert_split((v_s->>'id')::uuid, v_cheque_id, (v_i->>'id')::uuid, (v_s->>'contributor_id')::uuid, coalesce((v_s->>'ratio')::int,0), p_hlc, p_created_at);
    end loop;
  end loop;
end;
$$;

create function public.sync_update_cheque(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if p_payload ? 'visibility' and not is_cheque_owner(p_entity_id, p_user_id) then
    raise exception 'unauthorized: only owners change visibility';
  end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_CHEQUE', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_cheque(p_entity_id);
  update cheques set
    name = case when p_payload ? 'name' and p_hlc > coalesce(col_hlc->>'name','') then p_payload->>'name' else name end,
    visibility = case when p_payload ? 'visibility' and p_hlc > coalesce(col_hlc->>'visibility','') then (p_payload->>'visibility')::cheque_visibility else visibility end,
    col_hlc = col_hlc
      || (case when p_payload ? 'name'       and p_hlc > coalesce(col_hlc->>'name','')       then jsonb_build_object('name',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'visibility' and p_hlc > coalesce(col_hlc->>'visibility','') then jsonb_build_object('visibility',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where id = p_entity_id;
end;
$$;

create function public.sync_delete_cheque(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_members uuid[];
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not is_cheque_owner(p_entity_id, p_user_id) then raise exception 'unauthorized: only owners delete'; end if;
  select array_agg(user_id) into v_members from cheque_users where cheque_id = p_entity_id;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_CHEQUE',
                      jsonb_build_object('member_ids', coalesce(to_jsonb(v_members),'[]'::jsonb)), p_hlc, p_created_at) then return; end if;
  delete from cheques where id = p_entity_id;
end;
$$;

-- =====================  CONTRIBUTOR  =========================================
create function public.sync_add_contributor(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_c jsonb := p_payload->'contributor'; v_s jsonb;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'ADD_CONTRIBUTOR', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_cheque(p_entity_id);
  insert into cheque_contributors (cheque_id, id, name, sort, linked_user_id, hlc, col_hlc, is_stub, updated_at)
  values (p_entity_id, (v_c->>'id')::uuid, coalesce(v_c->>'name',''), coalesce((v_c->>'sort')::numeric,0),
          (v_c->>'linked_user_id')::uuid, p_hlc, jsonb_build_object('name',p_hlc,'sort',p_hlc), false, p_created_at)
  on conflict (cheque_id, id) do update set
    name = case when p_hlc > coalesce(cheque_contributors.col_hlc->>'name','') then excluded.name else cheque_contributors.name end,
    sort = case when p_hlc > coalesce(cheque_contributors.col_hlc->>'sort','') then excluded.sort else cheque_contributors.sort end,
    is_stub = false, col_hlc = cheque_contributors.col_hlc || excluded.col_hlc,
    hlc = greatest(cheque_contributors.hlc, p_hlc), updated_at = greatest(cheque_contributors.updated_at, p_created_at);
  for v_s in select * from jsonb_array_elements(coalesce(p_payload->'splits','[]'::jsonb)) loop
    perform _ensure_stub_item(p_entity_id, (v_s->>'item_id')::uuid);
    perform _upsert_split((v_s->>'id')::uuid, p_entity_id, (v_s->>'item_id')::uuid, (v_s->>'contributor_id')::uuid, coalesce((v_s->>'ratio')::int,0), p_hlc, p_created_at);
  end loop;
end;
$$;

create function public.sync_update_contributor(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid := (p_payload->>'id')::uuid;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if p_payload ? 'linked_user_id' and (p_payload->>'linked_user_id')::uuid <> p_user_id then
    raise exception 'unauthorized: can only link your own account';
  end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_CONTRIBUTOR', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_cheque(p_entity_id);
  perform _ensure_stub_contributor(p_entity_id, v_id);
  update cheque_contributors set
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

create function public.sync_delete_contributor(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_cid uuid := (p_payload->>'contributorId')::uuid; v_reassign uuid := (p_payload->>'reassignToId')::uuid;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_CONTRIBUTOR', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_contributor(p_entity_id, v_reassign);
  update cheque_items set contributor_id = v_reassign where cheque_id = p_entity_id and contributor_id = v_cid;
  delete from cheque_item_splits where cheque_id = p_entity_id and contributor_id = v_cid;
  delete from cheque_contributors where cheque_id = p_entity_id and id = v_cid;
end;
$$;

-- =====================  ITEM  ================================================
create function public.sync_add_item(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_i jsonb := p_payload->'item'; v_s jsonb;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'ADD_ITEM', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_cheque(p_entity_id);
  perform _ensure_stub_contributor(p_entity_id, (v_i->>'contributor_id')::uuid);
  insert into cheque_items (id, cheque_id, contributor_id, name, cost, sort, hlc, col_hlc, is_stub, updated_at)
  values ((v_i->>'id')::uuid, p_entity_id, (v_i->>'contributor_id')::uuid, coalesce(v_i->>'name',''),
          coalesce((v_i->>'cost')::bigint,0), coalesce((v_i->>'sort')::numeric,0), p_hlc,
          jsonb_build_object('name',p_hlc,'cost',p_hlc,'contributor_id',p_hlc,'sort',p_hlc), false, p_created_at)
  on conflict (id) do update set
    contributor_id = case when p_hlc > coalesce(cheque_items.col_hlc->>'contributor_id','') then excluded.contributor_id else cheque_items.contributor_id end,
    name = case when p_hlc > coalesce(cheque_items.col_hlc->>'name','') then excluded.name else cheque_items.name end,
    cost = case when p_hlc > coalesce(cheque_items.col_hlc->>'cost','') then excluded.cost else cheque_items.cost end,
    sort = case when p_hlc > coalesce(cheque_items.col_hlc->>'sort','') then excluded.sort else cheque_items.sort end,
    is_stub = false, col_hlc = cheque_items.col_hlc || excluded.col_hlc,
    hlc = greatest(cheque_items.hlc, p_hlc), updated_at = greatest(cheque_items.updated_at, p_created_at);
  for v_s in select * from jsonb_array_elements(coalesce(p_payload->'splits','[]'::jsonb)) loop
    perform _upsert_split((v_s->>'id')::uuid, p_entity_id, (v_i->>'id')::uuid, (v_s->>'contributor_id')::uuid, coalesce((v_s->>'ratio')::int,0), p_hlc, p_created_at);
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
  if p_payload ? 'contributor_id' then perform _ensure_stub_contributor(p_entity_id, (p_payload->>'contributor_id')::uuid); end if;
  update cheque_items set
    name = case when p_payload ? 'name' and p_hlc > coalesce(col_hlc->>'name','') then p_payload->>'name' else name end,
    cost = case when p_payload ? 'cost' and p_hlc > coalesce(col_hlc->>'cost','') then (p_payload->>'cost')::bigint else cost end,
    contributor_id = case when p_payload ? 'contributor_id' and p_hlc > coalesce(col_hlc->>'contributor_id','') then (p_payload->>'contributor_id')::uuid else contributor_id end,
    sort = case when p_payload ? 'sort' and p_hlc > coalesce(col_hlc->>'sort','') then (p_payload->>'sort')::numeric else sort end,
    col_hlc = col_hlc
      || (case when p_payload ? 'name' and p_hlc > coalesce(col_hlc->>'name','') then jsonb_build_object('name',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'cost' and p_hlc > coalesce(col_hlc->>'cost','') then jsonb_build_object('cost',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'contributor_id' and p_hlc > coalesce(col_hlc->>'contributor_id','') then jsonb_build_object('contributor_id',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'sort' and p_hlc > coalesce(col_hlc->>'sort','') then jsonb_build_object('sort',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where id = v_id and cheque_id = p_entity_id;
end;
$$;

create function public.sync_delete_item(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_ITEM', p_payload, p_hlc, p_created_at) then return; end if;
  delete from cheque_items where id = (p_payload->>'id')::uuid and cheque_id = p_entity_id;
end;
$$;

-- =====================  SPLIT  ===============================================
create function public.sync_add_split(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'ADD_SPLIT', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_cheque(p_entity_id);
  perform _ensure_stub_item(p_entity_id, (p_payload->>'item_id')::uuid);
  perform _ensure_stub_contributor(p_entity_id, (p_payload->>'contributor_id')::uuid);
  perform _upsert_split((p_payload->>'id')::uuid, p_entity_id, (p_payload->>'item_id')::uuid, (p_payload->>'contributor_id')::uuid, coalesce((p_payload->>'ratio')::int,0), p_hlc, p_created_at);
end;
$$;

create function public.sync_update_split(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid := (p_payload->>'id')::uuid;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_cheque_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_SPLIT', p_payload, p_hlc, p_created_at) then return; end if;
  insert into cheque_item_splits (id, cheque_id, is_stub) values (v_id, p_entity_id, true) on conflict (id) do nothing;
  update cheque_item_splits set
    ratio = case when p_hlc > coalesce(col_hlc->>'ratio','') then (p_payload->>'ratio')::int else ratio end,
    col_hlc = col_hlc || (case when p_hlc > coalesce(col_hlc->>'ratio','') then jsonb_build_object('ratio',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where id = v_id and cheque_id = p_entity_id;
end;
$$;

-- =====================  CHEQUE USER / USER  ==================================
create function public.sync_update_cheque_user(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_target uuid := (p_payload->>'userId')::uuid;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if p_payload ? 'role' then
    if not is_cheque_owner(p_entity_id, p_user_id) then raise exception 'unauthorized: only owners change roles'; end if;
  elsif not (p_user_id = v_target or is_cheque_owner(p_entity_id, p_user_id)) then
    raise exception 'unauthorized';
  end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_CHEQUE_USER', p_payload, p_hlc, p_created_at) then return; end if;
  update cheque_users set
    role = case when p_payload ? 'role' and p_hlc > coalesce(col_hlc->>'role','') then (p_payload->>'role')::cheque_role else role end,
    payment_id = case when p_payload ? 'payment_id' and p_hlc > coalesce(col_hlc->>'payment_id','') then p_payload->>'payment_id' else payment_id end,
    payment_method = case when p_payload ? 'payment_method' and p_hlc > coalesce(col_hlc->>'payment_method','') then (p_payload->>'payment_method')::payment_method else payment_method end,
    col_hlc = col_hlc
      || (case when p_payload ? 'role' and p_hlc > coalesce(col_hlc->>'role','') then jsonb_build_object('role',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'payment_id' and p_hlc > coalesce(col_hlc->>'payment_id','') then jsonb_build_object('payment_id',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'payment_method' and p_hlc > coalesce(col_hlc->>'payment_method','') then jsonb_build_object('payment_method',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where cheque_id = p_entity_id and user_id = v_target;
end;
$$;

create function public.sync_delete_cheque_user(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_target uuid := (p_payload->>'userId')::uuid;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not (p_user_id = v_target or is_cheque_owner(p_entity_id, p_user_id)) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_CHEQUE_USER', p_payload, p_hlc, p_created_at) then return; end if;
  delete from cheque_users where cheque_id = p_entity_id and user_id = v_target;
end;
$$;

create function public.sync_update_user(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if p_entity_id <> p_user_id then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_USER', p_payload, p_hlc, p_created_at) then return; end if;
  update users set
    default_visibility = case when p_payload ? 'default_visibility' and p_hlc > coalesce(col_hlc->>'default_visibility','') then (p_payload->>'default_visibility')::cheque_visibility else default_visibility end,
    default_payment_id = case when p_payload ? 'default_payment_id' and p_hlc > coalesce(col_hlc->>'default_payment_id','') then p_payload->>'default_payment_id' else default_payment_id end,
    default_payment_method = case when p_payload ? 'default_payment_method' and p_hlc > coalesce(col_hlc->>'default_payment_method','') then (p_payload->>'default_payment_method')::payment_method else default_payment_method end,
    col_hlc = col_hlc
      || (case when p_payload ? 'default_visibility' and p_hlc > coalesce(col_hlc->>'default_visibility','') then jsonb_build_object('default_visibility',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'default_payment_id' and p_hlc > coalesce(col_hlc->>'default_payment_id','') then jsonb_build_object('default_payment_id',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'default_payment_method' and p_hlc > coalesce(col_hlc->>'default_payment_method','') then jsonb_build_object('default_payment_method',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where id = p_user_id;
end;
$$;

create function public.sync_delete_user(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if p_entity_id <> p_user_id then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_USER', p_payload, p_hlc, p_created_at) then return; end if;
  delete from users where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Recreate invite redemption (role-rank helper + join fn), cheque-renamed.
-- ---------------------------------------------------------------------------
create function public._cheque_role_rank(r public.cheque_role)
returns int language sql immutable as $$
  select case r when 'owner' then 3 when 'editor' then 2 when 'viewer' then 1 else 0 end;
$$;

create function public.join_cheque_via_invite(
  p_cheque_id uuid, p_invite_id uuid, p_user_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite        public.invites%rowtype;
  v_existing_role public.cheque_role;
begin
  if p_user_id <> (select auth.uid()) then
    raise exception 'unauthorized: can only join as self';
  end if;

  select * into v_invite
    from invites
    where id = p_invite_id and cheque_id = p_cheque_id
    for update;

  if not found then
    raise exception 'invite not found';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'invite revoked';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'invite expired';
  end if;
  if v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses then
    raise exception 'invite exhausted';
  end if;

  -- FK target for cheque_users.user_id; handle_new_user normally creates this.
  insert into users (id) values (p_user_id) on conflict (id) do nothing;

  select role into v_existing_role
    from cheque_users where cheque_id = p_cheque_id and user_id = p_user_id;

  if v_existing_role is null then
    -- New member: join at the invite's role and consume one use.
    insert into cheque_users (cheque_id, user_id, role)
    values (p_cheque_id, p_user_id, v_invite.role);
    update invites set uses = uses + 1 where id = p_invite_id;
  elsif _cheque_role_rank(v_invite.role) > _cheque_role_rank(v_existing_role) then
    -- Existing member, lower role: upgrade (does not consume a use).
    update cheque_users set role = v_invite.role, updated_at = now()
      where cheque_id = p_cheque_id and user_id = p_user_id;
  end if;
  -- else: already a member at an equal/higher role — no-op (idempotent).
end;
$$;

revoke all on function public.join_cheque_via_invite(uuid, uuid, uuid) from public;
grant execute on function public.join_cheque_via_invite(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Recreate compaction fns (LATEST bodies: compact_cheque from
--     20260626000001; compact_stale_cheques from 20260626000002), renamed.
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
    'cheque_contributors', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'sort', c.sort, 'linked_user_id', c.linked_user_id)), '[]'::jsonb)
      from cheque_contributors c where c.cheque_id = b.id and not c.is_stub),
    'cheque_items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'contributor_id', i.contributor_id, 'name', i.name, 'cost', i.cost, 'sort', i.sort,
        'cheque_item_splits', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'item_id', s.item_id, 'contributor_id', s.contributor_id, 'ratio', s.ratio)), '[]'::jsonb)
          from cheque_item_splits s
          where s.item_id = i.id and not s.is_stub and s.contributor_id is not null))), '[]'::jsonb)
      from cheque_items i where i.cheque_id = b.id and not i.is_stub and i.contributor_id is not null),
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

create function public.compact_stale_cheques(p_threshold int default 500)
returns int language plpgsql security definer set search_path = public as $$
declare v_cheque uuid; v_count int := 0; v_candidates int := 0;
begin
  for v_cheque in
    select entity_id from mutation_logs
    where entity_id in (select id from cheques)         -- cheque-scoped logs only
    group by entity_id having count(*) > p_threshold
  loop
    v_candidates := v_candidates + 1;
    if compact_cheque(v_cheque) then v_count := v_count + 1; end if;
  end loop;
  raise log 'cheqii.compaction: compacted % of % candidate cheques (threshold %)',
    v_count, v_candidates, p_threshold;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Re-apply the SECURITY DEFINER lockdown from 20260626000002 for the
--     recreated maintenance/internal functions. (CREATE re-adds Supabase's
--     default anon/authenticated EXECUTE grants, so revoke them again.)
--     log_mutation / compaction_health were NOT recreated here (their bodies
--     reference no renamed objects), so their existing grants are untouched.
-- ---------------------------------------------------------------------------
revoke all on function public.compact_cheque(uuid)                 from public, anon, authenticated;
revoke all on function public.compact_stale_cheques(int)           from public, anon, authenticated;
revoke all on function public._upsert_split(uuid, uuid, uuid, uuid, int, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public._ensure_stub_cheque(uuid)            from public, anon, authenticated;
revoke all on function public._ensure_stub_contributor(uuid, uuid) from public, anon, authenticated;
revoke all on function public._ensure_stub_item(uuid, uuid)        from public, anon, authenticated;
revoke all on function public._cheque_role_rank(public.cheque_role) from public, anon, authenticated;

grant execute on function public.compact_cheque(uuid)       to service_role;
grant execute on function public.compact_stale_cheques(int) to service_role;

-- ---------------------------------------------------------------------------
-- 13. Reschedule the nightly compaction cron to the renamed function
--     (the old job referenced public.compact_stale_bills, now dropped).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('cheqii-compact-nightly');
  end if;
exception when others then
  raise notice 'pg_cron unschedule skipped: %', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('cheqii-compact-nightly', '0 3 * * *', 'select public.compact_stale_cheques(500);');
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 14. Rewrite the wire mutation-type strings stored in mutation_logs.type.
--     `type` is a plain text column (no CHECK constraint, no enum), so a single
--     UPDATE suffices: CREATE_BILL->CREATE_CHEQUE, UPDATE_BILL->UPDATE_CHEQUE,
--     DELETE_BILL->DELETE_CHEQUE, UPDATE_BILL_USER->UPDATE_CHEQUE_USER,
--     DELETE_BILL_USER->DELETE_CHEQUE_USER. (SNAPSHOT / ADD_* / *_ITEM /
--     *_SPLIT / *_CONTRIBUTOR / *_USER strings contain no 'BILL' substring.)
-- ---------------------------------------------------------------------------
update public.mutation_logs set type = replace(type, 'BILL', 'CHEQUE') where type like '%BILL%';

-- ---------------------------------------------------------------------------
-- 15. Recreate the RLS policies dropped in 6a, now bound to the renamed helper
--     functions and referencing the renamed tables/columns. Bodies are the
--     LATEST definitions (all from 20260625000002; 20260625000007 changed only
--     the sync_update function, no policies). Policy names are now cheque_*.
-- ---------------------------------------------------------------------------
-- cheques
create policy cheques_read on public.cheques for select to authenticated
  using (public.check_user_has_cheque_read_access(id, (select auth.uid())));
create policy cheques_insert on public.cheques for insert to authenticated
  with check (public.check_user_has_cheque_write_access(id, (select auth.uid())));
create policy cheques_update on public.cheques for update to authenticated
  using (public.check_user_has_cheque_write_access(id, (select auth.uid())));
create policy cheques_delete on public.cheques for delete to authenticated
  using (public.is_cheque_owner(id, (select auth.uid())));   -- only owners delete a cheque

-- cheque_users: read for members; writes owner-only
create policy cheque_users_read on public.cheque_users for select to authenticated
  using (public.check_user_has_cheque_read_access(cheque_id, (select auth.uid())));
create policy cheque_users_insert on public.cheque_users for insert to authenticated
  with check (public.is_cheque_owner(cheque_id, (select auth.uid())));
create policy cheque_users_update on public.cheque_users for update to authenticated
  using (public.is_cheque_owner(cheque_id, (select auth.uid())));
create policy cheque_users_delete on public.cheque_users for delete to authenticated
  using (public.is_cheque_owner(cheque_id, (select auth.uid())));

-- cheque_contributors
create policy cheque_contributors_read on public.cheque_contributors for select to authenticated
  using (not is_stub and public.check_user_has_cheque_read_access(cheque_id, (select auth.uid())));
create policy cheque_contributors_insert on public.cheque_contributors for insert to authenticated
  with check (public.check_user_has_cheque_write_access(cheque_id, (select auth.uid())));
create policy cheque_contributors_update on public.cheque_contributors for update to authenticated
  using (public.check_user_has_cheque_write_access(cheque_id, (select auth.uid())));
create policy cheque_contributors_delete on public.cheque_contributors for delete to authenticated
  using (public.check_user_has_cheque_write_access(cheque_id, (select auth.uid())));

-- cheque_items
create policy cheque_items_read on public.cheque_items for select to authenticated
  using (not is_stub and public.check_user_has_cheque_read_access(cheque_id, (select auth.uid())));
create policy cheque_items_insert on public.cheque_items for insert to authenticated
  with check (public.check_user_has_cheque_write_access(cheque_id, (select auth.uid())));
create policy cheque_items_update on public.cheque_items for update to authenticated
  using (public.check_user_has_cheque_write_access(cheque_id, (select auth.uid())));
create policy cheque_items_delete on public.cheque_items for delete to authenticated
  using (public.check_user_has_cheque_write_access(cheque_id, (select auth.uid())));

-- cheque_item_splits
create policy cheque_item_splits_read on public.cheque_item_splits for select to authenticated
  using (not is_stub and public.check_user_has_cheque_read_access(cheque_id, (select auth.uid())));
create policy cheque_item_splits_insert on public.cheque_item_splits for insert to authenticated
  with check (public.check_user_has_cheque_write_access(cheque_id, (select auth.uid())));
create policy cheque_item_splits_update on public.cheque_item_splits for update to authenticated
  using (public.check_user_has_cheque_write_access(cheque_id, (select auth.uid())));
create policy cheque_item_splits_delete on public.cheque_item_splits for delete to authenticated
  using (public.check_user_has_cheque_write_access(cheque_id, (select auth.uid())));

-- invites: owner-only (joins go through a SECURITY DEFINER RPC)
create policy invites_owner_read on public.invites for select to authenticated
  using (public.is_cheque_owner(cheque_id, (select auth.uid())));
create policy invites_owner_insert on public.invites for insert to authenticated
  with check (public.is_cheque_owner(cheque_id, (select auth.uid())));
create policy invites_owner_update on public.invites for update to authenticated
  using (public.is_cheque_owner(cheque_id, (select auth.uid())));
create policy invites_owner_delete on public.invites for delete to authenticated
  using (public.is_cheque_owner(cheque_id, (select auth.uid())));
