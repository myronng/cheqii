-- =============================================================================
-- Sync-RPC authorization test (Phase 6 security pass). The sync_* RPCs are the
-- real write boundary (SECURITY DEFINER, bypass RLS) — verify their in-function
-- authz. Non-destructive (txn + ROLLBACK). Run:
--   docker exec -i supabase_db_cheqii psql -U postgres -d postgres < supabase/tests/rpc_authz.sql
-- Expect all lines PASS.
-- =============================================================================
\set ON_ERROR_STOP on
begin;

insert into auth.users (id,email) values
  ('00000000-0000-0000-0000-0000000000f0','owner@t'),
  ('00000000-0000-0000-0000-0000000000f1','editor@t'),
  ('00000000-0000-0000-0000-0000000000f2','viewer@t');
insert into cheques (id,name,visibility,is_stub) values ('00000000-0000-0000-0000-00000000bf01','B','private',false);
insert into cheque_users (cheque_id,user_id,role) values
  ('00000000-0000-0000-0000-00000000bf01','00000000-0000-0000-0000-0000000000f0','owner'),
  ('00000000-0000-0000-0000-00000000bf01','00000000-0000-0000-0000-0000000000f1','editor'),
  ('00000000-0000-0000-0000-00000000bf01','00000000-0000-0000-0000-0000000000f2','viewer');
insert into cheque_people (cheque_id,id,name,sort,is_stub) values
  ('00000000-0000-0000-0000-00000000bf01','00000000-0000-0000-0000-0000000000c1','Alice',0,false);

do $$
declare b uuid := '00000000-0000-0000-0000-00000000bf01';
        owner uuid := '00000000-0000-0000-0000-0000000000f0';
        editor uuid := '00000000-0000-0000-0000-0000000000f1';
begin
  -- The sync_* RPCs require auth.uid() == the acting user (the "caller must act as
  -- self" guard added with user-binding). Impersonate each caller via the JWT
  -- claim before invoking, so these tests exercise the *role* authz below it.
  perform set_config('request.jwt.claims', json_build_object('sub', editor, 'role', 'authenticated')::text, true);

  -- visibility is owner-only (an editor must not be able to expose a private cheque)
  begin
    perform sync_update_cheque(gen_random_uuid(),editor,'9:0:n',now(),b,'{"visibility":"public_read"}'::jsonb);
    raise notice 'FAIL: editor changed visibility';
  exception when others then raise notice 'PASS: editor blocked from changing visibility'; end;

  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  perform sync_update_cheque(gen_random_uuid(),owner,'10:0:n',now(),b,'{"visibility":"public_read"}'::jsonb);
  raise notice '% owner can change visibility',
    case when (select visibility from cheques where id=b)='public_read' then 'PASS:' else 'FAIL:' end;

  -- editors keep collaborative edit rights (name)
  perform set_config('request.jwt.claims', json_build_object('sub', editor, 'role', 'authenticated')::text, true);
  perform sync_update_cheque(gen_random_uuid(),editor,'11:0:n',now(),b,'{"name":"Renamed"}'::jsonb);
  raise notice '% editor can still edit name',
    case when (select name from cheques where id=b)='Renamed' then 'PASS:' else 'FAIL:' end;

  -- role changes are owner-only (still acting as editor)
  begin
    perform sync_update_cheque_user(gen_random_uuid(),editor,'12:0:n',now(),b,
      jsonb_build_object('userId',editor,'role','owner'));
    raise notice 'FAIL: editor escalated own role';
  exception when others then raise notice 'PASS: non-owner blocked from role change'; end;

  -- a person slot can only be linked to the caller
  begin
    perform sync_update_person(gen_random_uuid(),editor,'13:0:n',now(),b,
      jsonb_build_object('id','00000000-0000-0000-0000-0000000000c1','linked_user_id',owner));
    raise notice 'FAIL: linked a slot to a non-caller user';
  exception when others then raise notice 'PASS: can only link a slot to yourself'; end;
end $$;

rollback;
