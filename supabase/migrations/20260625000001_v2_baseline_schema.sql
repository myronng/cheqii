-- =============================================================================
-- cheqii v2 — Phase 1 baseline schema
-- Implements docs/data-model-spec.md with the Phase-0 decisions locked in:
--   * money = bigint minor units (+ CHECK ceilings well under 2^53)
--   * per-bill ISO currency; first-class bills.tax / bills.tip
--   * explicit roles (owner|editor|viewer); visibility (private|public_read)
--   * per-column LWW (col_hlc) + hlc + is_stub on domain rows
--   * capability invites table; identity linking via linked_user_id
-- RLS lives in the companion migration (…_v2_rls.sql).
-- =============================================================================

-- ---------- Enums ------------------------------------------------------------
create type public.bill_role       as enum ('owner', 'editor', 'viewer');
create type public.payment_method  as enum ('etransfer', 'payPal');
-- public_edit deferred (Phase-0: no public write in v1); add via ALTER TYPE later.
create type public.bill_visibility as enum ('private', 'public_read');

-- ---------- users (app profile; 1:1 with auth.users) -------------------------
create table public.users (
  id                      uuid primary key references auth.users (id) on update cascade on delete cascade,
  default_visibility      public.bill_visibility not null default 'private',
  default_payment_id      text,
  default_payment_method  public.payment_method  not null default 'etransfer',
  updated_at              timestamptz not null default now(),
  hlc                     text not null default '',
  col_hlc                 jsonb not null default '{}'::jsonb,
  constraint users_payment_id_len check (default_payment_id is null or char_length(default_payment_id) <= 256)
);
comment on table public.users is 'Application profile data, keyed to auth.users.';

-- ---------- bills ------------------------------------------------------------
create table public.bills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  currency    text not null default 'CAD',
  visibility  public.bill_visibility not null default 'private',
  tax         bigint not null default 0,
  tip         bigint not null default 0,
  updated_at  timestamptz not null default now(),
  hlc         text not null default '',
  col_hlc     jsonb not null default '{}'::jsonb,
  is_stub     boolean not null default false,
  constraint bills_name_len  check (char_length(name) <= 256),
  constraint bills_currency  check (char_length(currency) = 3),
  -- ceilings kept well under Number.MAX_SAFE_INTEGER (2^53-1) so JS reads as plain number
  constraint bills_tax_range check (tax >= 0 and tax <= 999999999),
  constraint bills_tip_range check (tip >= 0 and tip <= 999999999)
);
comment on table public.bills is 'Bill header. Ownership/visibility via bill_users + visibility.';

-- ---------- bill_users (membership + per-bill payment info) ------------------
create table public.bill_users (
  bill_id         uuid not null references public.bills (id) on update cascade on delete cascade,
  user_id         uuid not null references public.users (id) on update cascade on delete cascade,
  role            public.bill_role not null,          -- no default: always set explicitly
  payment_id      text,
  payment_method  public.payment_method default 'etransfer',
  updated_at      timestamptz not null default now(),
  hlc             text not null default '',
  col_hlc         jsonb not null default '{}'::jsonb,
  primary key (user_id, bill_id),
  constraint bill_users_payment_id_len check (payment_id is null or char_length(payment_id) <= 256)
);
comment on table public.bill_users is 'Which users can access a bill, with what role.';

-- ---------- bill_contributors (the grid "columns") ---------------------------
create table public.bill_contributors (
  bill_id         uuid not null references public.bills (id) on update cascade on delete cascade,
  id              uuid not null default gen_random_uuid(),
  name            text not null default '',
  sort            numeric not null default 0,
  linked_user_id  uuid references public.users (id) on update cascade on delete set null,  -- identity link, no PK rewrite
  updated_at      timestamptz not null default now(),
  hlc             text not null default '',
  col_hlc         jsonb not null default '{}'::jsonb,
  is_stub         boolean not null default false,
  primary key (bill_id, id),
  constraint bill_contributors_name_len check (char_length(name) <= 256)
);
comment on table public.bill_contributors is 'Contributors (columns) within a bill; linked_user_id ties a slot to a real user.';

-- ---------- bill_items (the grid "rows") -------------------------------------
create table public.bill_items (
  id              uuid primary key default gen_random_uuid(),
  bill_id         uuid not null references public.bills (id) on update cascade on delete cascade,
  contributor_id  uuid,                               -- payer; nullable so out-of-order stub items can exist (filled on heal)
  name            text not null default '',
  cost            bigint not null default 0,          -- minor units
  sort            numeric not null default 0,
  updated_at      timestamptz not null default now(),
  hlc             text not null default '',
  col_hlc         jsonb not null default '{}'::jsonb,
  is_stub         boolean not null default false,
  constraint bill_items_name_len  check (char_length(name) <= 256),
  constraint bill_items_cost_range check (cost >= 0 and cost <= 999999999),
  foreign key (contributor_id, bill_id)
    references public.bill_contributors (id, bill_id) on update cascade on delete cascade
);
comment on table public.bill_items is 'Items (rows) within a bill; contributor_id is the payer.';

-- ---------- bill_item_splits (per-item ratio per contributor) ----------------
create table public.bill_item_splits (
  id              uuid primary key default gen_random_uuid(),
  bill_id         uuid not null references public.bills (id) on update cascade on delete cascade,
  item_id         uuid references public.bill_items (id) on update cascade on delete cascade,      -- nullable for stub splits
  contributor_id  uuid,                                                                            -- nullable for stub splits
  ratio           integer not null default 0,
  updated_at      timestamptz not null default now(),
  hlc             text not null default '',
  col_hlc         jsonb not null default '{}'::jsonb,
  is_stub         boolean not null default false,
  constraint bill_item_splits_ratio_range check (ratio >= 0 and ratio <= 9999999),
  foreign key (contributor_id, bill_id)
    references public.bill_contributors (id, bill_id) on update cascade on delete cascade
);
comment on table public.bill_item_splits is 'Split ratio of an item for a contributor.';

-- ---------- invites (capability tokens; replaces bills.invite_id) ------------
create table public.invites (
  id          uuid primary key default gen_random_uuid(),   -- the token
  bill_id     uuid not null references public.bills (id) on update cascade on delete cascade,
  role        public.bill_role not null,
  created_by  uuid references public.users (id) on update cascade on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  max_uses    integer,
  uses        integer not null default 0,
  revoked_at  timestamptz,
  constraint invites_role_not_owner check (role <> 'owner'),  -- never mint owner via link
  constraint invites_max_uses_pos   check (max_uses is null or max_uses > 0),
  constraint invites_uses_nonneg    check (uses >= 0)
);
comment on table public.invites is 'Scoped, expirable, revocable invite tokens. Joins go through a SECURITY DEFINER RPC (Phase 3).';

-- ---------- mutation_logs (append-only event feed + dedup ledger) ------------
create table public.mutation_logs (
  id           uuid primary key,                       -- client mutation id (idempotency)
  entity_id    uuid not null,                          -- bill id, or user id for user mutations (FK-less: tombstone survival)
  type         text not null,
  payload      jsonb not null,
  hlc          text not null,
  user_id      uuid references public.users (id) on update cascade on delete set null,  -- preserve tombstones authored by deleted users
  created_at   timestamptz not null default now(),
  seq_id       bigint generated always as identity
);
comment on table public.mutation_logs is 'Global append-only mutation log. entity_id intentionally FK-less so logs outlive deleted bills (tombstones).';
comment on column public.mutation_logs.entity_id is 'Bill id for bill mutations; user id for UPDATE_USER/DELETE_USER. No FK by design.';

-- ---------- indexes ----------------------------------------------------------
create index idx_bill_users_bill        on public.bill_users (bill_id);
create index idx_bill_contributors_bill on public.bill_contributors (bill_id);
create index idx_bill_items_bill        on public.bill_items (bill_id);
create index idx_bill_item_splits_bill  on public.bill_item_splits (bill_id);
create index idx_bill_item_splits_item  on public.bill_item_splits (item_id);
create index idx_invites_bill           on public.invites (bill_id);
create index idx_mutation_logs_seq      on public.mutation_logs (seq_id);
create index idx_mutation_logs_entity   on public.mutation_logs (entity_id, seq_id);  -- per-bill cursor pulls
create index idx_mutation_logs_user     on public.mutation_logs (user_id);

-- ---------- ordered_bill_splits view (caller-RLS; used by get_full_bill) -----
create view public.ordered_bill_splits with (security_invoker = true) as
  select
    bis.id,
    bis.ratio,
    bis.item_id,
    bis.contributor_id,
    bis.bill_id,
    bi.name  as item_name,
    bc.name  as contributor_name,
    bi.sort  as item_sort_order,
    bc.sort  as contributor_sort_order
  from public.bill_item_splits bis
    join public.bill_items bi on bis.item_id = bi.id
    join public.bill_contributors bc
      on bc.id = bis.contributor_id and bc.bill_id = bis.bill_id;
