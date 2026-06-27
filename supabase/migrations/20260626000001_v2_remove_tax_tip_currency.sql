-- =============================================================================
-- cheqii v2 — drop bill-level tax/tip and per-bill currency.
-- Product decision: a cheque splits arbitrary purchases (not one restaurant
-- receipt), so a single global tax/tip doesn't generalize — line items are now
-- entered tax/tip-inclusive (final amounts). Bills are also currency-agnostic:
-- amounts are plain decimals (minor units ×100), no per-bill currency code.
-- Recreates the three functions that referenced these columns.
-- =============================================================================

alter table public.bills
  drop column if exists tax,
  drop column if exists tip,
  drop column if exists currency;

-- ----- sync_create_bill (no currency/tax/tip) --------------------------------
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

-- ----- sync_update_bill (no currency/tax/tip; visibility stays owner-only) ----
create or replace function public.sync_update_bill(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
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

-- ----- compact_bill (snapshot without currency/tax/tip) ----------------------
create or replace function public.compact_bill(p_bill_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_payload  jsonb;
  v_hlc      text;
  v_owner    uuid;
  v_snap_seq bigint;
begin
  select max(hlc) into v_hlc from mutation_logs where entity_id = p_bill_id;
  if v_hlc is null then
    return false;
  end if;

  select user_id into v_owner from bill_users
    where bill_id = p_bill_id order by (role = 'owner') desc limit 1;
  if v_owner is null then
    return false;
  end if;

  select jsonb_build_object('bill', jsonb_build_object(
    'id', b.id, 'name', b.name, 'visibility', b.visibility,
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
    return false;
  end if;

  insert into mutation_logs (id, entity_id, type, payload, hlc, user_id, created_at)
  values (gen_random_uuid(), p_bill_id, 'SNAPSHOT', v_payload, v_hlc, v_owner, now())
  returning seq_id into v_snap_seq;

  delete from mutation_logs where entity_id = p_bill_id and seq_id < v_snap_seq;
  return true;
end;
$$;

revoke all on function public.compact_bill(uuid) from public;
