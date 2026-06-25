-- =============================================================================
-- cheqii v2 — Phase 1 RLS & access control
-- Implements docs/data-model-spec.md §RLS + docs/auth-invite-spec.md access matrix.
-- Key v2 properties vs v1:
--   * NO access bypass (no "invite_required=false" world-write, no "owner-absent" open access)
--   * is_stub rows are invisible to all non-system callers
--   * access functions are SECURITY DEFINER → recursion-safe (RLS on bill_users would
--     otherwise re-invoke these same functions)
--   * domain writes flow through SECURITY DEFINER sync RPCs (Phase 2) which bypass RLS;
--     these policies are defense-in-depth against direct PostgREST writes with a user JWT.
-- =============================================================================

-- ---------- access helpers (SECURITY DEFINER, recursion-safe) ----------------
create or replace function public.check_user_has_bill_read_access(p_bill_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public stable as $$
begin
  -- stub bills are invisible to everyone but the system
  if exists (select 1 from bills where id = p_bill_id and is_stub) then
    return false;
  end if;
  return exists (
    select 1 from bill_users where bill_id = p_bill_id and user_id = p_user_id
  ) or exists (
    select 1 from bills where id = p_bill_id and visibility = 'public_read'
  );
end;
$$;

create or replace function public.check_user_has_bill_write_access(p_bill_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public stable as $$
begin
  if exists (select 1 from bills where id = p_bill_id and is_stub) then
    return false;
  end if;
  -- editors and owners only; NO visibility / owner-absence bypass
  return exists (
    select 1 from bill_users
    where bill_id = p_bill_id and user_id = p_user_id and role in ('owner', 'editor')
  );
end;
$$;

create or replace function public.is_bill_owner(p_bill_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public stable as $$
begin
  return exists (
    select 1 from bill_users
    where bill_id = p_bill_id and user_id = p_user_id and role = 'owner'
  );
end;
$$;

grant execute on function public.check_user_has_bill_read_access(uuid, uuid)  to authenticated;
grant execute on function public.check_user_has_bill_write_access(uuid, uuid) to authenticated;
grant execute on function public.is_bill_owner(uuid, uuid)                    to authenticated;

-- ---------- auto-provision public.users on signup (anon + OAuth) -------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- enable RLS -------------------------------------------------------
alter table public.users             enable row level security;
alter table public.bills             enable row level security;
alter table public.bill_users        enable row level security;
alter table public.bill_contributors enable row level security;
alter table public.bill_items        enable row level security;
alter table public.bill_item_splits  enable row level security;
alter table public.invites           enable row level security;
alter table public.mutation_logs     enable row level security;

-- ---------- users: own row only ---------------------------------------------
create policy users_self_select on public.users for select to authenticated
  using (id = (select auth.uid()));
create policy users_self_insert on public.users for insert to authenticated
  with check (id = (select auth.uid()));
create policy users_self_update on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy users_self_delete on public.users for delete to authenticated
  using (id = (select auth.uid()));

-- ---------- bills ------------------------------------------------------------
create policy bills_read on public.bills for select to authenticated
  using (public.check_user_has_bill_read_access(id, (select auth.uid())));
create policy bills_insert on public.bills for insert to authenticated
  with check (public.check_user_has_bill_write_access(id, (select auth.uid())));
create policy bills_update on public.bills for update to authenticated
  using (public.check_user_has_bill_write_access(id, (select auth.uid())));
create policy bills_delete on public.bills for delete to authenticated
  using (public.is_bill_owner(id, (select auth.uid())));   -- only owners delete a bill

-- ---------- bill_users: read for members; writes owner-only -----------------
create policy bill_users_read on public.bill_users for select to authenticated
  using (public.check_user_has_bill_read_access(bill_id, (select auth.uid())));
create policy bill_users_insert on public.bill_users for insert to authenticated
  with check (public.is_bill_owner(bill_id, (select auth.uid())));
create policy bill_users_update on public.bill_users for update to authenticated
  using (public.is_bill_owner(bill_id, (select auth.uid())));
create policy bill_users_delete on public.bill_users for delete to authenticated
  using (public.is_bill_owner(bill_id, (select auth.uid())));

-- ---------- helper macro pattern for content tables --------------------------
-- bill_contributors
create policy bill_contributors_read on public.bill_contributors for select to authenticated
  using (not is_stub and public.check_user_has_bill_read_access(bill_id, (select auth.uid())));
create policy bill_contributors_insert on public.bill_contributors for insert to authenticated
  with check (public.check_user_has_bill_write_access(bill_id, (select auth.uid())));
create policy bill_contributors_update on public.bill_contributors for update to authenticated
  using (public.check_user_has_bill_write_access(bill_id, (select auth.uid())));
create policy bill_contributors_delete on public.bill_contributors for delete to authenticated
  using (public.check_user_has_bill_write_access(bill_id, (select auth.uid())));

-- bill_items
create policy bill_items_read on public.bill_items for select to authenticated
  using (not is_stub and public.check_user_has_bill_read_access(bill_id, (select auth.uid())));
create policy bill_items_insert on public.bill_items for insert to authenticated
  with check (public.check_user_has_bill_write_access(bill_id, (select auth.uid())));
create policy bill_items_update on public.bill_items for update to authenticated
  using (public.check_user_has_bill_write_access(bill_id, (select auth.uid())));
create policy bill_items_delete on public.bill_items for delete to authenticated
  using (public.check_user_has_bill_write_access(bill_id, (select auth.uid())));

-- bill_item_splits
create policy bill_item_splits_read on public.bill_item_splits for select to authenticated
  using (not is_stub and public.check_user_has_bill_read_access(bill_id, (select auth.uid())));
create policy bill_item_splits_insert on public.bill_item_splits for insert to authenticated
  with check (public.check_user_has_bill_write_access(bill_id, (select auth.uid())));
create policy bill_item_splits_update on public.bill_item_splits for update to authenticated
  using (public.check_user_has_bill_write_access(bill_id, (select auth.uid())));
create policy bill_item_splits_delete on public.bill_item_splits for delete to authenticated
  using (public.check_user_has_bill_write_access(bill_id, (select auth.uid())));

-- ---------- invites: owner-only (joins go through a SECURITY DEFINER RPC) ----
create policy invites_owner_read on public.invites for select to authenticated
  using (public.is_bill_owner(bill_id, (select auth.uid())));
create policy invites_owner_insert on public.invites for insert to authenticated
  with check (public.is_bill_owner(bill_id, (select auth.uid())));
create policy invites_owner_update on public.invites for update to authenticated
  using (public.is_bill_owner(bill_id, (select auth.uid())));
create policy invites_owner_delete on public.invites for delete to authenticated
  using (public.is_bill_owner(bill_id, (select auth.uid())));

-- ---------- mutation_logs ----------------------------------------------------
create policy mutation_logs_insert_own on public.mutation_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy mutation_logs_read on public.mutation_logs for select to authenticated
  using (
    -- A: bill still exists and caller is a member
    exists (
      select 1 from public.bill_users
      where bill_users.bill_id = mutation_logs.entity_id
        and bill_users.user_id = (select auth.uid())
    )
    -- B: caller authored the mutation (covers user-scoped mutations too)
    or user_id = (select auth.uid())
    -- C: caller was in the deleted bill's member snapshot (tombstone propagation)
    or (payload -> 'member_ids') @> jsonb_build_array((select auth.uid())::text)
  );
