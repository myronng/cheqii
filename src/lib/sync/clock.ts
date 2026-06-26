/**
 * Stateful wrapper around the pure HLC functions in `./hlc`. Owns the device's
 * current clock and advances it on local writes / incoming remote mutations.
 * The `node` id must be stable per device (persisted in the `meta` store); the
 * last clock state is persisted too so the clock stays monotonic across reloads.
 * See docs/sync-engine-spec.md §2.
 */
import { type HLCState, decodeHLC, encodeHLC, initHLC, tickLocal, tickReceive } from "./hlc";

export class HLCClock {
  #state: HLCState;
  readonly #now: () => number;

  constructor(node: string, opts?: { initial?: HLCState; now?: () => number }) {
    this.#state = opts?.initial ?? initHLC(node);
    this.#now = opts?.now ?? (() => Date.now());
  }

  get state(): HLCState {
    return this.#state;
  }

  get node(): string {
    return this.#state.node;
  }

  /** Stamp a locally-generated event and return the new encoded HLC. */
  tick(): string {
    this.#state = tickLocal(this.#state, this.#now());
    return encodeHLC(this.#state);
  }

  /** Merge a received remote HLC so the local clock stays ahead of causally-prior events. */
  receive(remoteEncoded: string): void {
    this.#state = tickReceive(this.#state, decodeHLC(remoteEncoded), this.#now());
  }

  /** Current encoded HLC without advancing the clock. */
  peek(): string {
    return encodeHLC(this.#state);
  }
}
