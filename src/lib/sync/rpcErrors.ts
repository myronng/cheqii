/**
 * Classify a failed `sync_*` RPC by its SQLSTATE / PostgREST error code, so
 * /api/sync can tell "this mutation can never succeed as-sent" (report in
 * `rejectedIds` → the client dead-letters it) apart from "this might work on
 * retry" (leave in the outbox).
 *
 * Deliberately conservative: only codes that are permanent *by construction*
 * are listed, and anything unknown (or missing — e.g. a network failure) is
 * treated as transient. Wrongly retrying a permanent failure costs a little
 * noise; wrongly dropping a transient one silently loses a user's edit.
 */

/** Whole SQLSTATE classes that are permanent for an identical retry. */
const PERMANENT_CLASSES = [
  "22", // data exception — e.g. 22P02 invalid uuid/enum cast; same input ⇒ same result
  "23", // integrity violation — e.g. 23503 FK, 23505 unique, 23514 check
];

const PERMANENT_CODES = new Set([
  // raise_exception — every guard in our sync_* RPCs ('unauthorized: …') raises
  // this. Guards depend only on durable state (membership/roles), so an identical
  // retry re-fails. Intra-batch ordering hazards (parent not applied *yet*) are
  // excluded by the caller, which stalls an entity's queue on a transient failure.
  "P0001",
  "42501", // insufficient_privilege — role grants don't change between retries
]);

// NOT listed (⇒ transient, retry): 40001/40P01 serialization/deadlock, 57014
// statement_timeout, 53* resources, 08* connection, and PGRST202 (function not in
// PostgREST's schema cache — parseMutation's type enum already gates unknown
// types, so this only occurs in the reload window right after a migration).

export function isPermanentSyncError(code: string | null | undefined): boolean {
  if (!code) return false;
  return PERMANENT_CODES.has(code) || PERMANENT_CLASSES.some((c) => code.startsWith(c));
}
