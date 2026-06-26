/**
 * Client write-path factory. `createMutation` stamps a fresh UUIDv7 + HLC and
 * validates the payload against its Zod schema *before* the mutation can be
 * persisted, so a malformed mutation can never enter the outbox (P6 — the same
 * schemas guard the server edge). See docs/sync-engine-spec.md §3.
 */
import type { HLCClock } from "./clock";
import { type Mutation, type MutationType, PAYLOAD_SCHEMAS } from "./mutations";
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
  return {
    id: uuidv7(),
    type,
    entity_id,
    user_id,
    hlc: clock.tick(),
    payload: parsed,
  };
}
