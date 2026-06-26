-- =============================================================================
-- cheqii v2 — security fix (Phase 6 audit): visibility is owner-only.
-- sync_update_bill gated on write access (editor OR owner), which let an EDITOR
-- flip a bill's visibility (private → public_read) and expose it. Visibility is a
-- privacy/ownership control — restrict it to owners, like role changes. name/
-- currency/tax/tip stay editor-allowed (collaborative editing). The UI already
-- gates the toggle to owners; this enforces it at the real boundary (the RPC).
-- =============================================================================
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
