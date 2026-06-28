-- =============================================================================
-- cheqii v2 — invite preview RPC.
--
-- A signed-out visitor on /auth (arriving from an invite link) can't read a
-- private cheque's name/counts via RLS. This SECURITY DEFINER function returns
-- only minimal, non-sensitive metadata (name + people/item counts) and ONLY when
-- the caller presents a valid (existing, non-revoked, non-expired, not-exhausted)
-- invite token for that cheque — the token is the capability. Granted to `anon`
-- so the pre-auth /auth page can call it.
-- =============================================================================
create function public.get_invite_preview(p_cheque_id uuid, p_invite_id uuid)
returns table (name text, people_count int, item_count int)
language plpgsql security definer set search_path = public stable as $$
declare v_invite public.invites%rowtype;
begin
  select * into v_invite from invites where id = p_invite_id and cheque_id = p_cheque_id;
  if not found then return; end if;
  if v_invite.revoked_at is not null then return; end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then return; end if;
  if v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses then return; end if;

  return query
    select
      c.name,
      (select count(*)::int from cheque_people p where p.cheque_id = c.id and not p.is_stub),
      (select count(*)::int from cheque_items i where i.cheque_id = c.id and not i.is_stub)
    from cheques c
    where c.id = p_cheque_id and not c.is_stub;
end;
$$;

revoke all on function public.get_invite_preview(uuid, uuid) from public;
grant execute on function public.get_invite_preview(uuid, uuid) to anon, authenticated;
