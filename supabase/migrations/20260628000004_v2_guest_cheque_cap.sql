-- Guest cheque cap: an anonymous (guest) user may belong to at most 6 cheques.
-- Signing in lifts the cap. Enforced here in the join path because it's a direct
-- awaited RPC — a rejection surfaces to the user and nothing is left in the sync
-- outbox to retry. (Creation is gated client-side for the same poison-avoidance
-- reason.) The friction is intentional; clearing app data + a new guest resets it.

create or replace function public.join_cheque_via_invite(
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

  -- Guest cap: only when joining as a brand-new member (upgrades/idempotent
  -- re-joins are exempt). The is_anonymous claim rides in the JWT.
  if v_existing_role is null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     and (select count(*) from cheque_users where user_id = p_user_id) >= 6
  then
    raise exception 'guest cheque limit reached';
  end if;

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
