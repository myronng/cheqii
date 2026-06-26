-- =============================================================================
-- RLS integration test (Phase 6) — exercises Row-Level Security under the real
-- `authenticated` role + JWT claims (NOT the access functions as superuser).
-- Non-destructive (wrapped in a transaction + ROLLBACK). Run against local Supabase:
--   docker exec -i supabase_db_cheqii psql -U postgres -d postgres < supabase/tests/rls_integration.sql
-- Expect all lines to print PASS.
-- =============================================================================
\set ON_ERROR_STOP on
begin;

-- ---- seed (as postgres: superuser bypasses RLS; handle_new_user makes public.users) ----
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a0','owner@t'),
  ('00000000-0000-0000-0000-0000000000a1','editor@t'),
  ('00000000-0000-0000-0000-0000000000a2','viewer@t'),
  ('00000000-0000-0000-0000-0000000000a3','stranger@t');

-- B1: private, owner+editor+viewer. B2: public_read. B3: stub.
insert into public.bills (id, name, visibility, is_stub) values
  ('00000000-0000-0000-0000-00000000b001','Private','private',false),
  ('00000000-0000-0000-0000-00000000b002','Public','public_read',false),
  ('00000000-0000-0000-0000-00000000b003','Stub','private',true);
insert into public.bill_users (bill_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-0000000000a0','owner'),
  ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-0000000000a1','editor'),
  ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-0000000000a2','viewer'),
  ('00000000-0000-0000-0000-00000000b002','00000000-0000-0000-0000-0000000000a0','owner');
insert into public.bill_contributors (bill_id, id, name, sort, is_stub) values
  ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-0000000000d1','Alice',0,false);
insert into public.bill_items (id, bill_id, contributor_id, name, cost, sort, is_stub) values
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-0000000000d1','Pizza',2000,0,false);
insert into mutation_logs (id, entity_id, type, payload, hlc, user_id) values
  (gen_random_uuid(),'00000000-0000-0000-0000-00000000b001','UPDATE_ITEM','{}'::jsonb,'000000000000001:0:n','00000000-0000-0000-0000-0000000000a0');

-- helper: run a read scenario as a given auth user, assert expected row presence
create function pg_temp.read_as(p_sub uuid, p_sql text, p_expect_rows boolean, p_label text)
returns void language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role','authenticated')::text, true);
  set local role authenticated;
  execute 'select count(*) from (' || p_sql || ') q' into n;
  set local role postgres;
  if (n > 0) = p_expect_rows then
    raise notice 'PASS: % (rows=%)', p_label, n;
  else
    raise notice 'FAIL: % (rows=%, expected_rows=%)', p_label, n, p_expect_rows;
  end if;
end $$;

-- ===================  READ scoping (load-bearing: pull/load rely on it)  ====
select pg_temp.read_as('00000000-0000-0000-0000-0000000000a0',
  'select 1 from bills where id=''00000000-0000-0000-0000-00000000b001''', true,
  'owner reads own private bill');
select pg_temp.read_as('00000000-0000-0000-0000-0000000000a3',
  'select 1 from bills where id=''00000000-0000-0000-0000-00000000b001''', false,
  'stranger CANNOT read private bill');
select pg_temp.read_as('00000000-0000-0000-0000-0000000000a3',
  'select 1 from bills where id=''00000000-0000-0000-0000-00000000b002''', true,
  'stranger CAN read public_read bill');
select pg_temp.read_as('00000000-0000-0000-0000-0000000000a0',
  'select 1 from bills where id=''00000000-0000-0000-0000-00000000b003''', false,
  'owner CANNOT read stub bill (invisible)');
select pg_temp.read_as('00000000-0000-0000-0000-0000000000a1',
  'select 1 from mutation_logs where entity_id=''00000000-0000-0000-0000-00000000b001''', true,
  'member reads bill mutation_logs');
select pg_temp.read_as('00000000-0000-0000-0000-0000000000a3',
  'select 1 from mutation_logs where entity_id=''00000000-0000-0000-0000-00000000b001''', false,
  'stranger CANNOT read bill mutation_logs');

-- ===================  WRITE defense-in-depth (clients normally use RPCs)  ====
do $$ declare n int; begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  set local role authenticated;
  update bill_items set name='edited-by-editor' where id='00000000-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  raise notice '% editor can update item (rows=%)', case when n>0 then 'PASS:' else 'FAIL:' end, n;
end $$;

do $$ declare n int; begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
  set local role authenticated;
  update bill_items set name='edited-by-viewer' where id='00000000-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  raise notice '% viewer CANNOT update item (rows=%)', case when n=0 then 'PASS:' else 'FAIL:' end, n;
end $$;

do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
  set local role authenticated;
  begin
    insert into bill_items (id, bill_id, contributor_id, name, cost, sort)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000d1', 'sneaky', 0, 1);
    raise notice 'FAIL: stranger inserted item into private bill';
  exception when others then
    raise notice 'PASS: stranger insert into private bill denied (%)', sqlerrm;
  end;
end $$;

rollback;
