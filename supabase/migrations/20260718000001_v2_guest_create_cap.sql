-- Guest cheque cap, create path. The join path has enforced "an anonymous user
-- may belong to at most 6 cheques" since 20260628000004; this adds the same
-- guard to sync_create_cheque so the cap can't be bypassed by creating instead
-- of joining. BACKSTOP ONLY: the client refuses to create at the cap
-- (createNewCheque → /limit) because creation is offline-first — a server
-- rejection here is classified permanent (P0001) and dead-letters the queued
-- CREATE_CHEQUE, discarding the guest's local cheque. That is the correct
-- outcome for a client that bypassed the gate, and unreachable for an honest one.
--
-- Only brand-new cheques count against the cap: replays/upserts of an existing
-- cheque (id already present, incl. stubs) are exempt, mirroring the join
-- guard's "brand-new member" exemption.
create or replace function public.sync_create_cheque(
  p_mutation_id uuid, p_user_id uuid, p_hlc text, p_created_at timestamptz, p_entity_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_cheque jsonb := p_payload->'cheque';
  v_cheque_id uuid := (v_cheque->>'id')::uuid;
  v_c jsonb; v_i jsonb; v_s jsonb;
begin
  if p_user_id is distinct from (select auth.uid()) then raise exception 'unauthorized: caller must act as self'; end if;
  if exists (select 1 from cheques where id = v_cheque_id and not is_stub)
     and not is_cheque_owner(v_cheque_id, p_user_id) then
    raise exception 'unauthorized: cheque % already exists', v_cheque_id;
  end if;

  -- Guest cap (see header comment). The is_anonymous claim rides in the JWT.
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     and not exists (select 1 from cheques where id = v_cheque_id)
     and (select count(*) from cheque_users where user_id = p_user_id) >= 6
  then
    raise exception 'guest cheque limit reached';
  end if;

  if not log_mutation(p_mutation_id, v_cheque_id, p_user_id, 'CREATE_CHEQUE', p_payload, p_hlc, p_created_at) then return; end if;

  insert into cheques (id, name, visibility, hlc, col_hlc, is_stub, updated_at)
  values (v_cheque_id, coalesce(v_cheque->>'name',''),
          coalesce((v_cheque->>'visibility')::cheque_visibility,'private'),
          p_hlc, jsonb_build_object('name',p_hlc,'visibility',p_hlc),
          false, p_created_at)
  on conflict (id) do update set
    name = case when p_hlc > coalesce(cheques.col_hlc->>'name','') then excluded.name else cheques.name end,
    visibility = case when p_hlc > coalesce(cheques.col_hlc->>'visibility','') then excluded.visibility else cheques.visibility end,
    is_stub = false,
    col_hlc = cheques.col_hlc || excluded.col_hlc,
    hlc = greatest(cheques.hlc, p_hlc),
    updated_at = greatest(cheques.updated_at, p_created_at);

  insert into cheque_users (cheque_id, user_id, role, hlc, updated_at)
  values (v_cheque_id, p_user_id, 'owner', p_hlc, p_created_at)
  on conflict (user_id, cheque_id) do nothing;

  for v_c in select * from jsonb_array_elements(coalesce(v_cheque->'cheque_people','[]'::jsonb)) loop
    insert into cheque_people (cheque_id, id, name, sort, linked_user_id, hlc, col_hlc, is_stub, updated_at)
    values (v_cheque_id, (v_c->>'id')::uuid, coalesce(v_c->>'name',''), coalesce((v_c->>'sort')::numeric,0),
            (v_c->>'linked_user_id')::uuid, p_hlc, jsonb_build_object('name',p_hlc,'sort',p_hlc), false, p_created_at)
    on conflict (cheque_id, id) do update set
      name = case when p_hlc > coalesce(cheque_people.col_hlc->>'name','') then excluded.name else cheque_people.name end,
      sort = case when p_hlc > coalesce(cheque_people.col_hlc->>'sort','') then excluded.sort else cheque_people.sort end,
      is_stub = false, col_hlc = cheque_people.col_hlc || excluded.col_hlc,
      hlc = greatest(cheque_people.hlc, p_hlc), updated_at = greatest(cheque_people.updated_at, p_created_at);
  end loop;

  for v_i in select * from jsonb_array_elements(coalesce(v_cheque->'cheque_items','[]'::jsonb)) loop
    insert into cheque_items (id, cheque_id, person_id, name, cost, sort, hlc, col_hlc, is_stub, updated_at)
    values ((v_i->>'id')::uuid, v_cheque_id, (v_i->>'person_id')::uuid, coalesce(v_i->>'name',''),
            coalesce((v_i->>'cost')::bigint,0), coalesce((v_i->>'sort')::numeric,0), p_hlc,
            jsonb_build_object('name',p_hlc,'cost',p_hlc,'person_id',p_hlc,'sort',p_hlc), false, p_created_at)
    on conflict (id) do nothing;
    for v_s in select * from jsonb_array_elements(coalesce(v_i->'cheque_item_splits','[]'::jsonb)) loop
      perform _upsert_split((v_s->>'id')::uuid, v_cheque_id, (v_i->>'id')::uuid, (v_s->>'person_id')::uuid, coalesce((v_s->>'ratio')::int,0), p_hlc, p_created_at);
    end loop;
  end loop;
end;
$$;
