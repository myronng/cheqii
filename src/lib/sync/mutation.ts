/**
 * Client write-path factory. `createMutation` stamps a fresh UUIDv7 + HLC and
 * validates the *entire envelope* (scope ids + payload) against its Zod schema
 * before the mutation can be persisted, so a malformed mutation can never enter
 * the outbox (P6 — the same schemas guard the server edge). See docs/sync-engine-spec.md §3.
 */
import type { HLCClock } from "./clock";
import {
  type Mutation,
  type MutationType,
  PAYLOAD_SCHEMAS,
  mutationEnvelopeSchema,
} from "./mutations";
import { uuidv7 } from "./uuid";

export function createMutation<T extends MutationType>(
  clock: HLCClock,
  type: T,
  entity_id: string,
  user_id: string,
  payload: unknown,
): Mutation<T> {
  // Throws on invalid payload — caller must not have persisted anything yet.
  const parsed = PAYLOAD_SCHEMAS[type].parse(payload) as Mutation<T>["payload"];
  const mutation: Mutation<T> = {
    id: uuidv7(),
    type,
    entity_id,
    user_id,
    hlc: clock.tick(),
    payload: parsed,
  };
  // Validate the whole envelope, not just the payload: entity_id/user_id must be
  // real UUIDs (and id/hlc well-formed). The server rejects a malformed envelope
  // at /api/sync *before* dispatching — so a bad entity_id (e.g. the migrated
  // md5-derived ids) would apply locally but never sync, silently. Failing here,
  // at the write site, keeps such a mutation out of the outbox entirely.
  mutationEnvelopeSchema.parse(mutation);
  return mutation;
}
