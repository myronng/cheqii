-- =============================================================================
-- cheqii v2 — SECURITY: bind sync_* p_user_id to auth.uid().
-- The sync_* RPCs are SECURITY DEFINER and take p_user_id (the acting user). The
-- legit caller (/api/sync) always passes the authenticated user.id, but the
-- functions never verified that — and Supabase default-grants EXECUTE to anon +
-- authenticated, so any signed-in client could call them DIRECTLY with a forged
-- p_user_id and write as another member of a bill they can name (notably public
-- bills, where member user-ids are discoverable via the pull). Add a guard to
-- every sync_* asserting p_user_id = auth.uid(); the /api/sync path is unaffected.
-- Bodies are reproduced verbatim from 000003 / 20260626000001 with only the guard
-- line added as the first statement.
-- =============================================================================

-- =====================  BILL  ================================================
create or replace function public.sync_create_bill(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_bill jsonb := p_payload->'bill';
  v_bill_id uuid := (v_bill->>'id')::uuid;
  v_c jsonb; v_i jsonb; v_s jsonb;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if exists (select 1 from bills where id = v_bill_id and not is_stub)
     and not is_bill_owner(v_bill_id, p_user_id) then
    raise exception 'unauthorized: bill % already exists', v_bill_id;
  end if;
  if not log_mutation(p_mutation_id, v_bill_id, p_user_id, 'CREATE_BILL', p_payload, p_hlc, p_created_at) then return; end if;

  insert into bills (id, name, visibility, hlc, col_hlc, is_stub, updated_at)
  values (v_bill_id, coalesce(v_bill->>'name',''),
          coalesce((v_bill->>'visibility')::bill_visibility,'private'),
          p_hlc, jsonb_build_object('name',p_hlc,'visibility',p_hlc),
          false, p_created_at)
  on conflict (id) do update set
    name = case when p_hlc > coalesce(bills.col_hlc->>'name','') then excluded.name else bills.name end,
    visibility = case when p_hlc > coalesce(bills.col_hlc->>'visibility','') then excluded.visibility else bills.visibility end,
    is_stub = false,
    col_hlc = bills.col_hlc || excluded.col_hlc,
    hlc = greatest(bills.hlc, p_hlc),
    updated_at = greatest(bills.updated_at, p_created_at);

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
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if p_payload ? 'visibility' and not is_bill_owner(p_entity_id, p_user_id) then
    raise exception 'unauthorized: only owners change visibility';
  end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_BILL', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_bill(p_entity_id);
  update bills set
    name = case when p_payload ? 'name' and p_hlc > coalesce(col_hlc->>'name','') then p_payload->>'name' else name end,
    visibility = case when p_payload ? 'visibility' and p_hlc > coalesce(col_hlc->>'visibility','') then (p_payload->>'visibility')::bill_visibility else visibility end,
    col_hlc = col_hlc
      || (case when p_payload ? 'name'       and p_hlc > coalesce(col_hlc->>'name','')       then jsonb_build_object('name',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'visibility' and p_hlc > coalesce(col_hlc->>'visibility','') then jsonb_build_object('visibility',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where id = p_entity_id;
end;
$$;

create or replace function public.sync_delete_bill(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_members uuid[];
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not is_bill_owner(p_entity_id, p_user_id) then raise exception 'unauthorized: only owners delete'; end if;
  select array_agg(user_id) into v_members from bill_users where bill_id = p_entity_id;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_BILL',
                      jsonb_build_object('member_ids', coalesce(to_jsonb(v_members),'[]'::jsonb)), p_hlc, p_created_at) then return; end if;
  delete from bills where id = p_entity_id;
end;
$$;

-- =====================  CONTRIBUTOR  =========================================
create or replace function public.sync_add_contributor(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_c jsonb := p_payload->'contributor'; v_s jsonb;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
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
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
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
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_CONTRIBUTOR', p_payload, p_hlc, p_created_at) then return; end if;
  perform _ensure_stub_contributor(p_entity_id, v_reassign);
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
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
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
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
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
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_ITEM', p_payload, p_hlc, p_created_at) then return; end if;
  delete from bill_items where id = (p_payload->>'id')::uuid and bill_id = p_entity_id;
end;
$$;

-- =====================  SPLIT  ===============================================
create or replace function public.sync_add_split(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
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
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not check_user_has_bill_write_access(p_entity_id, p_user_id) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'UPDATE_SPLIT', p_payload, p_hlc, p_created_at) then return; end if;
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
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
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
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if not (p_user_id = v_target or is_bill_owner(p_entity_id, p_user_id)) then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_BILL_USER', p_payload, p_hlc, p_created_at) then return; end if;
  delete from bill_users where bill_id = p_entity_id and user_id = v_target;
end;
$$;

create or replace function public.sync_update_user(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if p_entity_id <> p_user_id then raise exception 'unauthorized'; end if;
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
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if p_entity_id <> p_user_id then raise exception 'unauthorized'; end if;
  if not log_mutation(p_mutation_id, p_entity_id, p_user_id, 'DELETE_USER', p_payload, p_hlc, p_created_at) then return; end if;
  delete from users where id = p_user_id;
end;
$$;
