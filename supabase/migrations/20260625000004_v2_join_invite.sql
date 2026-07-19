-- =============================================================================
-- cheqii v2 — Phase 3 auth & invite
-- Capability-token invite redemption. See docs/auth-invite-spec.md §3.3 / §4.
-- The invites table (Phase 1) already carries role / expires_at / max_uses /
-- uses / revoked_at; this adds the redemption RPC the /invite route calls.
-- =============================================================================

-- Total order over roles so an upgrade never silently demotes an existing member.
create or replace function public._bill_role_rank(r public.bill_role)
returns int language sql immutable as $$
  select case r when 'owner' then 3 when 'editor' then 2 when 'viewer' then 1 else 0 end;
$$;

-- Redeem an invite token and join the bill with its role.
--   * SECURITY DEFINER: validates the token without the caller having any prior
--     access to the bill or the invites row (RLS would otherwise hide both).
--   * Authorization: the caller may only join as themselves (= auth.uid()).
--   * Idempotent: a repeat join by an existing member is a no-op; an invite for a
--     higher role upgrades the member. Only a genuinely new membership consumes a use.
--   * Concurrency-safe: the invite row is locked so parallel redemptions can't
--     oversubscribe max_uses.
-- Raises on any invalid condition; the /invite loader maps that to a vague 404.
create or replace function public.join_bill_via_invite(
  p_bill_id uuid, p_invite_id uuid, p_user_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite        public.invites%rowtype;
  v_existing_role public.bill_role;
begin
  if p_user_id <> (select auth.uid()) then
    raise exception 'unauthorized: can only join as self';
  end if;

  select * into v_invite
    from invites
    where id = p_invite_id and bill_id = p_bill_id
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

  -- FK target for bill_users.user_id; handle_new_user normally creates this.
  insert into users (id) values (p_user_id) on conflict (id) do nothing;

  select role into v_existing_role
    from bill_users where bill_id = p_bill_id and user_id = p_user_id;

  if v_existing_role is null then
    -- New member: join at the invite's role and consume one use.
    insert into bill_users (bill_id, user_id, role)
    values (p_bill_id, p_user_id, v_invite.role);
    update invites set uses = uses + 1 where id = p_invite_id;
  elsif _bill_role_rank(v_invite.role) > _bill_role_rank(v_existing_role) then
    -- Existing member, lower role: upgrade (does not consume a use).
    update bill_users set role = v_invite.role, updated_at = now()
      where bill_id = p_bill_id and user_id = p_user_id;
  end if;
  -- else: already a member at an equal/higher role — no-op (idempotent).
end;
$$;

-- Callable by authenticated users (the function gates authorization internally).
revoke all on function public.join_bill_via_invite(uuid, uuid, uuid) from public;
grant execute on function public.join_bill_via_invite(uuid, uuid, uuid) to authenticated;
