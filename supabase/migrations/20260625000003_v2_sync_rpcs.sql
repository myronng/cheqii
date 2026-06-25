-- =============================================================================
-- cheqii v2 — Phase 2 sync RPCs
-- Idempotent, resilient mutation appliers. See docs/sync-engine-spec.md §3/§6.
-- Conventions for every applier:
--   signature (p_mutation_id uuid, p_user_id uuid, p_hlc text,
--              p_created_at timestamptz, p_entity_id uuid, p_payload jsonb)
--   * log_mutation() dedups by mutation id (replay/echo/retry are no-ops)
--   * parents are ensured as is_stub=true rows so out-of-order children never FK-fail
--   * per-column LWW: a column is overwritten only when p_hlc > col_hlc[column];
--     stub rows have empty col_hlc so any real write wins and heals them
--   * authoritative ADD/CREATE sets is_stub=false (materialize)
--   * authorization is enforced IN the RPC (these run SECURITY DEFINER, bypassing RLS)
-- =============================================================================

-- ---------- dedup ledger -----------------------------------------------------
create or replace function public.log_mutation(
  p_id uuid, p_entity_id uuid, p_user_id uuid, p_type text, p_payload jsonb, p_hlc text, p_created_at timestamptz
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into users (id) values (p_user_id) on conflict (id) do nothing;
  if exists (select 1 from mutation_logs where id = p_id) then
    return false;                               -- already applied
  end if;
  insert into mutation_logs (id, entity_id, type, payload, hlc, user_id, created_at)
  values (p_id, p_entity_id, p_type, p_payload, p_hlc, p_user_id, p_created_at);
  return true;
end;
$$;

-- ---------- tiny stub-ensure helpers ----------------------------------------
create or replace function public._ensure_stub_bill(p_bill uuid)
returns void language sql security definer set search_path = public as $$
  insert into bills (id, is_stub) values (p_bill, true) on conflict (id) do nothing;
$$;
create or replace function public._ensure_stub_contributor(p_bill uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into bill_contributors (bill_id, id, is_stub) values (p_bill, p_id, true) on conflict (bill_id, id) do nothing;
$$;
create or replace function public._ensure_stub_item(p_bill uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into bill_items (id, bill_id, is_stub) values (p_id, p_bill, true) on conflict (id) do nothing;
$$;

-- Upsert a split, healing a stub (fills structural item_id/contributor_id once, LWW on ratio).
create or replace function public._upsert_split(
  p_id uuid, p_bill uuid, p_item uuid, p_contrib uuid, p_ratio int, p_hlc text, p_created_at timestamptz
) returns void language sql security definer set search_path = public as $$
  insert into bill_item_splits (id, bill_id, item_id, contributor_id, ratio, hlc, col_hlc, is_stub, updated_at)
  values (p_id, p_bill, p_item, p_contrib, p_ratio, p_hlc, jsonb_build_object('ratio', p_hlc), false, p_created_at)
  on conflict (id) do update set
    item_id        = coalesce(bill_item_splits.item_id, excluded.item_id),               -- structural: fill once
    contributor_id = coalesce(bill_item_splits.contributor_id, excluded.contributor_id),
    ratio          = case when p_hlc > coalesce(bill_item_splits.col_hlc->>'ratio','') then excluded.ratio else bill_item_splits.ratio end,
    is_stub        = false,
    col_hlc        = bill_item_splits.col_hlc || excluded.col_hlc,
    hlc            = greatest(bill_item_splits.hlc, p_hlc),
    updated_at     = greatest(bill_item_splits.updated_at, p_created_at);
$$;

-- =====================  BILL  ================================================
create or replace function public.sync_create_bill(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_bill jsonb := p_payload->'bill';
  v_bill_id uuid := (v_bill->>'id')::uuid;
  v_c jsonb; v_i jsonb; v_s jsonb;
begin
  -- anti-hijack: cannot CREATE over an existing real bill you don't own
  if exists (select 1 from bills where id = v_bill_id and not is_stub)
     and not is_bill_owner(v_bill_id, p_user_id) then
    raise exception 'unauthorized: bill % already exists', v_bill_id;
  end if;
  if not log_mutation(p_mutation_id, v_bill_id, p_user_id, 'CREATE_BILL', p_payload, p_hlc, p_created_at) then return; end if;

  insert into bills (id, name, currency, visibility, tax, tip, hlc, col_hlc, is_stub, updated_at)
  values (v_bill_id, coalesce(v_bill->>'name',''), coalesce(v_bill->>'currency','CAD'),
          coalesce((v_bill->>'visibility')::bill_visibility,'private'),
          coalesce((v_bill->>'tax')::bigint,0), coalesce((v_bill->>'tip')::bigint,0),
          p_hlc, jsonb_build_object('name',p_hlc,'currency',p_hlc,'visibility',p_hlc,'tax',p_hlc,'tip',p_hlc),
          false, p_created_at)
  on conflict (id) do update set
    name = case when p_hlc > coalesce(bills.col_hlc->>'name','') then excluded.name else bills.name end,
    currency = case when p_hlc > coalesce(bills.col_hlc->>'currency','') then excluded.currency else bills.currency end,
    visibility = case when p_hlc > coalesce(bills.col_hlc->>'visibility','') then excluded.visibility else bills.visibility end,
    tax = case when p_hlc > coalesce(bills.col_hlc->>'tax','') then excluded.tax else bills.tax end,
    tip = case when p_hlc > coalesce(bills.col_hlc->>'tip','') then excluded.tip else bills.tip end,
    is_stub = false,
    col_hlc = bills.col_hlc || excluded.col_hlc,
    hlc = greatest(bills.hlc, p_hlc),
    updated_at = greatest(bills.updated_at, p_created_at);

  -- creator becomes owner (do not downgrade an existing membership)
  insert into bill_users (bill_id, user_id, role, hlc, updated_at)
  values (v_bill_id, p_user_id, 'owner', p_hlc, p_created_at)
  on conflict (user_id, bill_id) do nothing;

  for v_c in select * from jsonb_array_elements(coalesce(v_bill->'bill_contributors','[]'::jsonb)) loop
    insert into bill_contributors (bill_id, id, name, sort, linked_user_id, hlc, col_hlc, is_stub, updated_at)
    values (v_bill_id, (v_c->>'id')::uuid, coalesce(v_c->>'name',''), coalesce((v_c->>'sort')::numeric,0),
            (v_c->>'linked_user_id')::uuid, p_hlc, jsonb_build_object('name',p_hlc,'sort',p_hlc), false, p_created_at)
    on conflict (bill_id, id) do update set
      name = case when p_hlc > coalesce(bill_contributors.col_hlc->>'name','') then excluded.name else bill_contributors.name end,
      sort = case when p_hlc > coalesce(bill_contributors.col_hlc->>'sort','') then excluded.sort else bill_contributors.sort end,
      is_stub = false, col_hlc = bill_contributors.col_hlc || excluded.col_hlc,
      hlc = greatest(bill_contributors.hlc, p_hlc), updated_at = greatest(bill_contributors.updated_at, p_created_at);
  end loop;

  for v_i in select * from jsonb_array_elements(coalesce(v_bill->'bill_items','[]'::jsonb)) loop
    insert into bill_items (id, bill_id, contributor_id, name, cost, sort, hlc, col_hlc, is_stub, updated_at)
    values ((v_i->>'id')::uuid, v_bill_id, (v_i->>'contributor_id')::uuid, coalesce(v_i->>'name',''),
            coalesce((v_i->>'cost')::bigint,0), coalesce((v_i->>'sort')::numeric,0), p_hlc,
            jsonb_build_object('name',p_hlc,'cost',p_hlc,'contributor_id',p_hlc,'sort',p_hlc), false, p_created_at)
    on conflict (id) do nothing;
    for v_s in select * from jsonb_array_elements(coalesce(v_i->'bill_item_splits','[]'::jsonb)) loop
      perform _upsert_split((v_s->>'id')::uuid, v_bill_id, (v_i->>'id')::uuid, (v_s->>'contributor_id')::uuid, coalesce((v_s->>'ratio')::int,0), p_hlc, p_created_at);
    end loop;
  end loop;
end;
$$;

create or replace function public.sync_update_bill(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_BILL', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_bill(p_entity_id);
  update bills set
    name = case when p_payload ? 'name' and p_hlc > coalesce(col_hlc->>'name','') then p_payload->>'name' else name end,
    currency = case when p_payload ? 'currency' and p_hlc > coalesce(col_hlc->>'currency','') then p_payload->>'currency' else currency end,
    visibility = case when p_payload ? 'visibility' and p_hlc > coalesce(col_hlc->>'visibility','') then (p_payload->>'visibility')::bill_visibility else visibility end,
    tax = case when p_payload ? 'tax' and p_hlc > coalesce(col_hlc->>'tax','') then (p_payload->>'tax')::bigint else tax end,
    tip = case when p_payload ? 'tip' and p_hlc > coalesce(col_hlc->>'tip','') then (p_payload->>'tip')::bigint else tip end,
    col_hlc = col_hlc
      || (case when p_payload ? 'name'       and p_hlc > coalesce(col_hlc->>'name','')       then jsonb_build_object('name',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'currency'   and p_hlc > coalesce(col_hlc->>'currency','')   then jsonb_build_object('currency',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'visibility' and p_hlc > coalesce(col_hlc->>'visibility','') then jsonb_build_object('visibility',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'tax'        and p_hlc > coalesce(col_hlc->>'tax','')        then jsonb_build_object('tax',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'tip'        and p_hlc > coalesce(col_hlc->>'tip','')        then jsonb_build_object('tip',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where id = p_entity_id;
end;
$$;

create or replace function public.sync_delete_bill(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_members uuid[];
begin
  if not is_bill_owner(p_entity_id, p_user_id) then raise exception 'unauthorized: only owners delete'; end if;
  select array_agg(user_id) into v_members from bill_users where bill_id = p_entity_id;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_BILL',
                      jsonb_build_object('member_ids', coalesce(to_jsonb(v_members),'[]'::jsonb)), p_hlc, p_created_at) then return; end if;
  delete from bills where id = p_entity_id;   -- cascades to all bill_* + invites
end;
$$;

-- =====================  CONTRIBUTOR  =========================================
create or replace function public.sync_add_contributor(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_c jsonb := p_payload->'contributor'; v_s jsonb;
begin
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'ADD_CONTRIBUTOR', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_bill(p_entity_id);
  insert into bill_contributors (bill_id, id, name, sort, linked_user_id, hlc, col_hlc, is_stub, updated_at)
  values (p_entity_id, (v_c->>'id')::uuid, coalesce(v_c->>'name',''), coalesce((v_c->>'sort')::numeric,0),
          (v_c->>'linked_user_id')::uuid, p_hlc, jsonb_build_object('name',p_hlc,'sort',p_hlc), false, p_created_at)
  on conflict (bill_id, id) do update set
    name = case when p_hlc > coalesce(bill_contributors.col_hlc->>'name','') then excluded.name else bill_contributors.name end,
    sort = case when p_hlc > coalesce(bill_contributors.col_hlc->>'sort','') then excluded.sort else bill_contributors.sort end,
    is_stub = false, col_hlc = bill_contributors.col_hlc || excluded.col_hlc,
    hlc = greatest(bill_contributors.hlc, p_hlc), updated_at = greatest(bill_contributors.updated_at, p_created_at);
  for v_s in select * from jsonb_array_elements(coalesce(p_payload->'splits','[]'::jsonb)) loop
    perform _ensure_stub_item(p_entity_id, (v_s->>'item_id')::uuid);
    perform _upsert_split((v_s->>'id')::uuid, p_entity_id, (v_s->>'item_id')::uuid, (v_s->>'contributor_id')::uuid, coalesce((v_s->>'ratio')::int,0), p_hlc, p_created_at);
  end loop;
end;
$$;

create or replace function public.sync_update_contributor(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid := (p_payload->>'id')::uuid;
begin
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  -- you may only link a contributor slot to YOURSELF
  if p_payload ? 'linked_user_id' and (p_payload->>'linked_user_id')::uuid <> p_user_id then
    raise exception 'unauthorized: can only link your own account';
  end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_CONTRIBUTOR', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_bill(p_entity_id);
  perform _ensure_stub_contributor(p_entity_id, v_id);
  update bill_contributors set
    name = case when p_payload ? 'name' and p_hlc > coalesce(col_hlc->>'name','') then p_payload->>'name' else name end,
    sort = case when p_payload ? 'sort' and p_hlc > coalesce(col_hlc->>'sort','') then (p_payload->>'sort')::numeric else sort end,
    linked_user_id = case when p_payload ? 'linked_user_id' and p_hlc > coalesce(col_hlc->>'linked_user_id','') then (p_payload->>'linked_user_id')::uuid else linked_user_id end,
    col_hlc = col_hlc
      || (case when p_payload ? 'name' and p_hlc > coalesce(col_hlc->>'name','') then jsonb_build_object('name',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'sort' and p_hlc > coalesce(col_hlc->>'sort','') then jsonb_build_object('sort',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'linked_user_id' and p_hlc > coalesce(col_hlc->>'linked_user_id','') then jsonb_build_object('linked_user_id',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where bill_id = p_entity_id and id = v_id;
end;
$$;

create or replace function public.sync_delete_contributor(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_cid uuid := (p_payload->>'contributorId')::uuid; v_reassign uuid := (p_payload->>'reassignToId')::uuid;
begin
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_CONTRIBUTOR', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_contributor(p_entity_id, v_reassign);  -- reassign target must exist
  update bill_items set contributor_id = v_reassign where bill_id = p_entity_id and contributor_id = v_cid;
  delete from bill_item_splits where bill_id = p_entity_id and contributor_id = v_cid;
  delete from bill_contributors where bill_id = p_entity_id and id = v_cid;
end;
$$;

-- =====================  ITEM  ================================================
create or replace function public.sync_add_item(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_i jsonb := p_payload->'item'; v_s jsonb;
begin
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'ADD_ITEM', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_bill(p_entity_id);
  perform _ensure_stub_contributor(p_entity_id, (v_i->>'contributor_id')::uuid);
  insert into bill_items (id, bill_id, contributor_id, name, cost, sort, hlc, col_hlc, is_stub, updated_at)
  values ((v_i->>'id')::uuid, p_entity_id, (v_i->>'contributor_id')::uuid, coalesce(v_i->>'name',''),
          coalesce((v_i->>'cost')::bigint,0), coalesce((v_i->>'sort')::numeric,0), p_hlc,
          jsonb_build_object('name',p_hlc,'cost',p_hlc,'contributor_id',p_hlc,'sort',p_hlc), false, p_created_at)
  on conflict (id) do update set
    contributor_id = case when p_hlc > coalesce(bill_items.col_hlc->>'contributor_id','') then excluded.contributor_id else bill_items.contributor_id end,
    name = case when p_hlc > coalesce(bill_items.col_hlc->>'name','') then excluded.name else bill_items.name end,
    cost = case when p_hlc > coalesce(bill_items.col_hlc->>'cost','') then excluded.cost else bill_items.cost end,
    sort = case when p_hlc > coalesce(bill_items.col_hlc->>'sort','') then excluded.sort else bill_items.sort end,
    is_stub = false, col_hlc = bill_items.col_hlc || excluded.col_hlc,
    hlc = greatest(bill_items.hlc, p_hlc), updated_at = greatest(bill_items.updated_at, p_created_at);
  for v_s in select * from jsonb_array_elements(coalesce(p_payload->'splits','[]'::jsonb)) loop
    perform _upsert_split((v_s->>'id')::uuid, p_entity_id, (v_i->>'id')::uuid, (v_s->>'contributor_id')::uuid, coalesce((v_s->>'ratio')::int,0), p_hlc, p_created_at);
  end loop;
end;
$$;

create or replace function public.sync_update_item(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid := (p_payload->>'id')::uuid;
begin
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_ITEM', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_bill(p_entity_id);
  perform _ensure_stub_item(p_entity_id, v_id);
  if p_payload ? 'contributor_id' then perform _ensure_stub_contributor(p_entity_id, (p_payload->>'contributor_id')::uuid); end if;
  update bill_items set
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
  where id = v_id and bill_id = p_entity_id;
end;
$$;

create or replace function public.sync_delete_item(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_ITEM', p_payload, p_hlc, p_created_at) then return; end if;
  delete from bill_items where id = (p_payload->>'id')::uuid and bill_id = p_entity_id;  -- splits cascade
end;
$$;

-- =====================  SPLIT  ===============================================
create or replace function public.sync_add_split(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'ADD_SPLIT', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_bill(p_entity_id);
  perform _ensure_stub_item(p_entity_id, (p_payload->>'item_id')::uuid);
  perform _ensure_stub_contributor(p_entity_id, (p_payload->>'contributor_id')::uuid);
  perform _upsert_split((p_payload->>'id')::uuid, p_entity_id, (p_payload->>'item_id')::uuid, (p_payload->>'contributor_id')::uuid, coalesce((p_payload->>'ratio')::int,0), p_hlc, p_created_at);
end;
$$;

create or replace function public.sync_update_split(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid := (p_payload->>'id')::uuid;
begin
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_SPLIT', p_payload, p_hlc, p_created_at) then return; end if;
  -- ensure the split row exists as a stub (parents unknown here, so create a bare stub split)
  insert into bill_item_splits (id, bill_id, is_stub) values (v_id, p_entity_id, true) on conflict (id) do nothing;
  update bill_item_splits set
    ratio = case when p_hlc > coalesce(col_hlc->>'ratio','') then (p_payload->>'ratio')::int else ratio end,
    col_hlc = col_hlc || (case when p_hlc > coalesce(col_hlc->>'ratio','') then jsonb_build_object('ratio',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where id = v_id and bill_id = p_entity_id;
end;
$$;

-- =====================  BILL USER / USER  ====================================
create or replace function public.sync_update_bill_user(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_target uuid := (p_payload->>'userId')::uuid;
begin
  -- role changes are owner-only; payment changes allowed for self or owner
  if p_payload ? 'role' then
    if not is_bill_owner(p_entity_id, p_user_id) then raise exception 'unauthorized: only owners change roles'; end if;
  elsif not (p_user_id = v_target or is_bill_owner(p_entity_id, p_user_id)) then
    raise exception 'unauthorized';
  end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_BILL_USER', p_payload, p_hlc, p_created_at) then return; end if;
  update bill_users set
    role = case when p_payload ? 'role' and p_hlc > coalesce(col_hlc->>'role','') then (p_payload->>'role')::bill_role else role end,
    payment_id = case when p_payload ? 'payment_id' and p_hlc > coalesce(col_hlc->>'payment_id','') then p_payload->>'payment_id' else payment_id end,
    payment_method = case when p_payload ? 'payment_method' and p_hlc > coalesce(col_hlc->>'payment_method','') then (p_payload->>'payment_method')::payment_method else payment_method end,
    col_hlc = col_hlc
      || (case when p_payload ? 'role' and p_hlc > coalesce(col_hlc->>'role','') then jsonb_build_object('role',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'payment_id' and p_hlc > coalesce(col_hlc->>'payment_id','') then jsonb_build_object('payment_id',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'payment_method' and p_hlc > coalesce(col_hlc->>'payment_method','') then jsonb_build_object('payment_method',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where bill_id = p_entity_id and user_id = v_target;
end;
$$;

create or replace function public.sync_delete_bill_user(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_target uuid := (p_payload->>'userId')::uuid;
begin
  -- self-removal (leave) or owner removing another
  if not (p_user_id = v_target or is_bill_owner(p_entity_id, p_user_id)) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_BILL_USER', p_payload, p_hlc, p_created_at) then return; end if;
  delete from bill_users where bill_id = p_entity_id and user_id = v_target;
end;
$$;

create or replace function public.sync_update_user(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_entity_id <> p_user_id then raise exception 'unauthorized'; end if;   -- self only
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_USER', p_payload, p_hlc, p_created_at) then return; end if;
  update users set
    default_visibility = case when p_payload ? 'default_visibility' and p_hlc > coalesce(col_hlc->>'default_visibility','') then (p_payload->>'default_visibility')::bill_visibility else default_visibility end,
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

create or replace function public.sync_delete_user(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_entity_id <> p_user_id then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_USER', p_payload, p_hlc, p_created_at) then return; end if;
  delete from users where id = p_user_id;   -- cascades bill_users; mutation_logs.user_id set null
end;
$$;
