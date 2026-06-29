-- One person per user, enforced at the sync source.
--
-- A user may be linked to at most one person per cheque. Rather than a hard
-- unique constraint (a rejected sync RPC stays in the outbox and retries forever),
-- sync_update_person *self-heals*: when a mutation links the caller to a slot and
-- wins LWW, it first releases any other slot in the cheque they were linked to.
-- The cleared slot's linked_user_id col_hlc is bumped to the same hlc so the
-- release propagates to other devices. This makes re-claiming a clean switch and
-- can never reject, so the outbox never wedges.

create or replace function public.sync_update_person(
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

  -- Switching: if this mutation links the caller to v_id (and wins LWW), release
  -- any other slot they currently hold so a user maps to exactly one person.
  if p_payload ? 'linked_user_id'
     and (p_payload->>'linked_user_id') is not null
     and (p_payload->>'linked_user_id')::uuid = p_user_id
     and p_hlc > coalesce(
       (select col_hlc->>'linked_user_id' from cheque_people where cheque_id = p_entity_id and id = v_id), ''
     )
  then
    update cheque_people set
      linked_user_id = null,
      col_hlc = col_hlc || jsonb_build_object('linked_user_id', p_hlc),
      hlc = greatest(hlc, p_hlc), updated_at = greatest(updated_at, p_created_at)
    where cheque_id = p_entity_id and id <> v_id and linked_user_id = p_user_id;
  end if;

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
