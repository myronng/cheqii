/**
 * Hybrid Logical Clock (HLC) — total, causality-respecting order across devices.
 * See docs/sync-engine-spec.md §2.
 *
 * Encoded as a fixed-width, lexicographically-comparable string:
 *   "<wall:15><counter:05><node>"  (`:`-separated)
 * so plain string comparison (and Postgres text comparison) yields the HLC order.
 * `wall` is epoch milliseconds; 15 digits is ample headroom. `counter` disambiguates
 * events within the same millisecond. `node` is a per-device id breaking final ties
 * so every device picks the same winner deterministically.
 */

export interface HLCState {
  wall: number;
  counter: number;
  node: string;
}

const WALL_DIGITS = 15;
const COUNTER_DIGITS = 5;
const MAX_COUNTER = 10 ** COUNTER_DIGITS - 1;

/** Create an initial clock for a device. `node` should be a stable per-device id. */
export function initHLC(node: string): HLCState {
  return { wall: 0, counter: 0, node };
}

export function encodeHLC(s: HLCState): string {
  return [
    String(s.wall).padStart(WALL_DIGITS, "0"),
    String(s.counter).padStart(COUNTER_DIGITS, "0"),
    s.node,
  ].join(":");
}

export function decodeHLC(encoded: string): HLCState {
  const [wall, counter, ...nodeParts] = encoded.split(":");
  return {
    wall: Number(wall),
    counter: Number(counter),
    // node ids must not contain ":"; rejoin defensively just in case
    node: nodeParts.join(":"),
  };
}

/** Lexicographic compare of two encoded HLCs. Negative if a<b, positive if a>b, 0 if equal. */
export function compareHLC(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function guardCounter(counter: number): number {
  // Pathological same-ms bursts could overflow the counter width. Extremely unlikely
  // for a cheque app; surface it loudly rather than silently breaking ordering.
  if (counter > MAX_COUNTER) {
    throw new Error(`HLC counter overflow (> ${MAX_COUNTER}); wall clock likely stuck`);
  }
  return counter;
}

/** Advance the clock for a locally-generated event. `now` = physical epoch ms. */
export function tickLocal(prev: HLCState, now: number): HLCState {
  const wall = Math.max(now, prev.wall);
  const counter = wall === prev.wall ? guardCounter(prev.counter + 1) : 0;
  return { wall, counter, node: prev.node };
}

/** Merge a received remote HLC into the local clock. `now` = physical epoch ms. */
export function tickReceive(prev: HLCState, remote: HLCState, now: number): HLCState {
  const wall = Math.max(now, prev.wall, remote.wall);
  let counter: number;
  if (wall === prev.wall && wall === remote.wall) {
    counter = Math.max(prev.counter, remote.counter) + 1;
  } else if (wall === prev.wall) {
    counter = prev.counter + 1;
  } else if (wall === remote.wall) {
    counter = remote.counter + 1;
  } else {
    counter = 0;
  }
  return { wall, counter: guardCounter(counter), node: prev.node };
}
