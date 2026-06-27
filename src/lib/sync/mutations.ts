/**
 * Canonical mutation contracts — the single source of truth shared by the client
 * write-path and the server `/api/sync` validator (P6). Each mutation type has a Zod
 * schema; the server validates `payload` against it before dispatching to `sync_<type>`.
 * See docs/sync-engine-spec.md §3/§5 and docs/data-model-spec.md.
 */

import { z } from "zod";

// ---- shared scalars ---------------------------------------------------------
const uuid = z.string().uuid();
const hlc = z.string().min(1);
// money: integer minor units, kept under the CHECK ceilings (well below 2^53)
const minorUnits = z.number().int().min(0).max(999_999_999);
const ratio = z.number().int().min(0).max(9_999_999);
const sort = z.number();
const name = z.string().max(256);
const paymentMethod = z.enum(["etransfer", "payPal"]);
const role = z.enum(["owner", "editor", "viewer"]);
const visibility = z.enum(["private", "public_read"]);

const splitSchema = z.object({
  id: uuid,
  item_id: uuid,
  contributor_id: uuid,
  ratio,
});

// Full bill state, nested (server builds it; CREATE_BILL + SNAPSHOT both carry it).
const billStateSchema = z.object({
  id: uuid,
  name,
  visibility,
  bill_contributors: z.array(z.object({ id: uuid, name, sort, linked_user_id: uuid.nullish() })),
  bill_items: z.array(
    z.object({
      id: uuid,
      contributor_id: uuid,
      name,
      cost: minorUnits,
      sort,
      bill_item_splits: z.array(splitSchema),
    }),
  ),
});

// ---- per-type payload schemas ----------------------------------------------
// UPDATE_* payloads carry only the fields being changed (per-column LWW).
export const PAYLOAD_SCHEMAS = {
  CREATE_BILL: z.object({ bill: billStateSchema }),

  // Compaction (sync spec §8): server-generated full-state checkpoint stamped with
  // the max HLC; the client replaces its snapshot wholesale. Adds bill_users so a
  // cold-start client also gets membership.
  SNAPSHOT: z.object({
    bill: billStateSchema.extend({
      bill_users: z.array(
        z.object({
          user_id: uuid,
          role,
          payment_id: z.string().max(256).nullish(),
          payment_method: paymentMethod.nullish(),
        }),
      ),
    }),
  }),
  UPDATE_BILL: z
    .object({ name, visibility })
    .partial()
    .refine((o) => Object.keys(o).length > 0, "UPDATE_BILL requires at least one field"),
  DELETE_BILL: z.object({ member_ids: z.array(uuid) }),

  ADD_CONTRIBUTOR: z.object({
    contributor: z.object({ id: uuid, name, sort, linked_user_id: uuid.nullish() }),
    splits: z.array(splitSchema),
  }),
  UPDATE_CONTRIBUTOR: z
    .object({ id: uuid, name, sort, linked_user_id: uuid })
    .partial({ name: true, sort: true, linked_user_id: true })
    .required({ id: true }),
  DELETE_CONTRIBUTOR: z.object({ contributorId: uuid, reassignToId: uuid }),

  ADD_ITEM: z.object({
    item: z.object({ id: uuid, contributor_id: uuid, name, cost: minorUnits, sort }),
    splits: z.array(splitSchema),
  }),
  UPDATE_ITEM: z
    .object({ id: uuid, name, cost: minorUnits, contributor_id: uuid, sort })
    .partial({ name: true, cost: true, contributor_id: true, sort: true })
    .required({ id: true }),
  DELETE_ITEM: z.object({ id: uuid }),

  ADD_SPLIT: splitSchema,
  UPDATE_SPLIT: z.object({ id: uuid, ratio }),

  UPDATE_BILL_USER: z
    .object({
      userId: uuid,
      role,
      payment_id: z.string().max(256).nullable(),
      payment_method: paymentMethod,
    })
    .partial({ role: true, payment_id: true, payment_method: true })
    .required({ userId: true }),
  DELETE_BILL_USER: z.object({ userId: uuid }),

  UPDATE_USER: z
    .object({
      default_visibility: visibility,
      default_payment_id: z.string().max(256).nullable(),
      default_payment_method: paymentMethod,
    })
    .partial()
    .refine((o) => Object.keys(o).length > 0, "UPDATE_USER requires at least one field"),
  DELETE_USER: z.object({}).strict(),
} as const;

export type MutationType = keyof typeof PAYLOAD_SCHEMAS;
export const MUTATION_TYPES = Object.keys(PAYLOAD_SCHEMAS) as MutationType[];

/** entity_id is the bill id for bill-scoped mutations, or the user id for UPDATE_USER/DELETE_USER. */
const USER_SCOPED: ReadonlySet<MutationType> = new Set(["UPDATE_USER", "DELETE_USER"]);
export const isUserScoped = (t: MutationType) => USER_SCOPED.has(t);

/** The wire/outbox unit. `hlc` carries causal time; `id` is a sortable UUIDv7. */
export interface Mutation<T extends MutationType = MutationType> {
  id: string;
  type: T;
  entity_id: string;
  user_id: string;
  hlc: string;
  payload: z.infer<(typeof PAYLOAD_SCHEMAS)[T]>;
}

export const mutationEnvelopeSchema = z.object({
  id: uuid,
  type: z.enum(MUTATION_TYPES as [MutationType, ...MutationType[]]),
  entity_id: uuid,
  user_id: uuid,
  hlc,
  payload: z.unknown(),
});

/** Validate an incoming mutation envelope + its type-specific payload. */
export function parseMutation(input: unknown): Mutation {
  const env = mutationEnvelopeSchema.parse(input);
  const payload = PAYLOAD_SCHEMAS[env.type].parse(env.payload);
  return { ...env, payload } as Mutation;
}

/** Map a mutation type to its Postgres RPC name (`UPDATE_ITEM` → `sync_update_item`). */
export const rpcNameFor = (t: MutationType) => `sync_${t.toLowerCase()}`;
