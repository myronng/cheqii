-- =============================================================================
-- cheqii v2 — per-member "claim dismissed" flag.
--
-- When a member opts out of claiming a person slot ("I'm not listed separately"),
-- record it on their membership row so the join prompt isn't shown again — synced
-- across their devices. Per-column LWW via UPDATE_CHEQUE_USER, like the payment
-- fields. Also carried in the compaction snapshot so it survives a compaction.
-- =============================================================================
alter table public.cheque_users
  add column if not exists claim_dismissed boolean not null default false;

-- ---------------------------------------------------------------------------
-- sync_update_cheque_user: handle claim_dismissed (self-settable; col-LWW).
-- ---------------------------------------------------------------------------
create or replace function public.sync_update_cheque_user(
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
    claim_dismissed = case when p_payload ? 'claim_dismissed' and p_hlc > coalesce(col_hlc->>'claim_dismissed','') then (p_payload->>'claim_dismissed')::boolean else claim_dismissed end,
    col_hlc = col_hlc
      || (case when p_payload ? 'role' and p_hlc > coalesce(col_hlc->>'role','') then jsonb_build_object('role',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'payment_id' and p_hlc > coalesce(col_hlc->>'payment_id','') then jsonb_build_object('payment_id',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'payment_method' and p_hlc > coalesce(col_hlc->>'payment_method','') then jsonb_build_object('payment_method',p_hlc) else '{}'::jsonb end)
      || (case when p_payload ? 'claim_dismissed' and p_hlc > coalesce(col_hlc->>'claim_dismissed','') then jsonb_build_object('claim_dismissed',p_hlc) else '{}'::jsonb end),
    hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
  where cheque_id = p_entity_id and user_id = v_target;
end;
$$;

-- ---------------------------------------------------------------------------
-- compact_cheque: include claim_dismissed in the snapshot's cheque_users.
-- ---------------------------------------------------------------------------
create or replace function public.compact_cheque(p_cheque_id uuid)
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
        'payment_id', bu.payment_id, 'payment_method', bu.payment_method,
        'claim_dismissed', bu.claim_dismissed)), '[]'::jsonb)
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
