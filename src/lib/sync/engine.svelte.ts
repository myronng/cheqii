/**
 * The sync pump. A single-flight loop that pushes the outbox and pulls peers'
 * mutations in one round-trip — but with **pull decoupled from the outbox**, so
 * an idle device still receives updates (the v1 gap). Push uses exponential
 * backoff with jitter; pull is driven by liveness sources (see ./liveness).
 * See docs/sync-engine-spec.md §4.
 */
import { compareHLC } from "./hlc";
import type { Mutation, MutationType } from "./mutations";

/** A `mutation_logs` row as returned by the pull side of `/api/sync`. */
export interface LogRow {
  id: string;
  type: MutationType;
  entity_id: string;
  user_id: string | null;
  hlc: string;
  payload: unknown;
  seq_id: number;
  created_at?: string;
}

interface SyncResponse {
  processedIds: string[];
  newMutations: LogRow[];
  cursors: Record<string, number>;
}

/** Persistence surface the engine needs — satisfied by SyncDB, mockable in tests. */
export interface EngineStore {
  loadOutbox(): Promise<Mutation[]>;
  clearOutbox(ids: string[]): Promise<void>;
  getCursors(): Promise<Record<string, number>>;
  setCursor(entity_id: string, seq_id: number): Promise<unknown>;
}

export interface SyncEngineDeps {
  db: EngineStore;
  /** Local clock — fed every incoming HLC so subsequent local writes order after them. */
  clock: { receive(encoded: string): void };
  getUserId: () => string | undefined;
  /** Reduce incoming peer mutations into local snapshots (Phase 5 supplies this). */
  onIncoming: (rows: LogRow[]) => Promise<void>;
  fetchFn?: typeof fetch;
}

const MIN_BACKOFF = 1_000;
const MAX_BACKOFF = 128_000;

export class SyncEngine {
  #syncing = $state(false);
  #pending = $state(0);
  #online = $state(true);

  #outbox: Mutation[] = [];
  #cursors: Record<string, number> = {};
  #backoff = MIN_BACKOFF;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #rerun = false;

  readonly #deps: SyncEngineDeps;
  readonly #fetch: typeof fetch;
  readonly ready: Promise<void>;

  constructor(deps: SyncEngineDeps) {
    this.#deps = deps;
    this.#fetch = deps.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.ready = this.#init();
  }

  get isSyncing(): boolean {
    return this.#syncing;
  }
  get pendingCount(): number {
    return this.#pending;
  }
  get isOnline(): boolean {
    return this.#online;
  }

  async #init(): Promise<void> {
    this.#outbox = await this.#deps.db.loadOutbox();
    this.#cursors = await this.#deps.db.getCursors();
    this.#pending = this.#outbox.length;
    this.requestSync();
  }

  /** Enqueue a locally-created mutation (already durably committed by the write path). */
  enqueue(mutation: Mutation): void {
    this.#outbox.push(mutation);
    this.#pending = this.#outbox.length;
    this.requestSync();
  }

  /** Liveness trigger: sync now even if the outbox is empty (pull-only). */
  pull(): void {
    this.requestSync();
  }

  setOnline(online: boolean): void {
    this.#online = online;
    if (online) this.requestSync();
  }

  requestSync(delay = 0): void {
    if (this.#syncing) {
      this.#rerun = true;
      return;
    }
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#run();
    }, delay);
  }

  async #run(): Promise<void> {
    if (this.#syncing) return;
    const userId = this.#deps.getUserId();
    if (!userId) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.#online = false;
      return;
    }
    this.#online = true;
    this.#syncing = true;

    try {
      // Push the user's pending mutations in causal (HLC) order so parents
      // precede children; cursors ride along to pull peers' updates.
      const batch = this.#outbox
        .filter((m) => m.user_id === userId)
        .sort((a, b) => compareHLC(a.hlc, b.hlc));

      const res = await this.#fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutations: batch, cursors: this.#cursors }),
      });
      if (!res.ok) throw new Error(`/api/sync responded ${res.status}`);
      const data = (await res.json()) as SyncResponse;

      const processed = new Set(data.processedIds);
      if (processed.size > 0) {
        await this.#deps.db.clearOutbox(data.processedIds);
        this.#outbox = this.#outbox.filter((m) => !processed.has(m.id));
        this.#pending = this.#outbox.length;
      }

      // Apply peers' mutations (never our own just-acked ones).
      const incoming = data.newMutations.filter((m) => !processed.has(m.id));
      if (incoming.length > 0) {
        for (const m of incoming) this.#deps.clock.receive(m.hlc);
        await this.#deps.onIncoming(incoming);
      }

      for (const [entity, seq] of Object.entries(data.cursors)) {
        if (seq > (this.#cursors[entity] ?? 0)) {
          this.#cursors[entity] = seq;
          await this.#deps.db.setCursor(entity, seq);
        }
      }

      this.#backoff = MIN_BACKOFF; // progress (or a clean pull) resets backoff
      this.#finish(userId, false);
    } catch (err) {
      console.error("[sync] round failed:", err);
      this.#backoff = Math.min(this.#backoff * 2, MAX_BACKOFF);
      this.#finish(userId, true);
    }
  }

  #finish(userId: string, errored: boolean): void {
    this.#syncing = false;
    if (this.#rerun) {
      this.#rerun = false;
      this.requestSync();
      return;
    }
    // Reschedule a push only while the user still has pending mutations; an
    // idle pull-only device waits for the next liveness trigger instead.
    const hasPending = this.#outbox.some((m) => m.user_id === userId);
    if (errored || hasPending) {
      this.requestSync(jitter(this.#backoff));
    }
  }
}

/** ±20% jitter to de-correlate retries across clients. */
function jitter(base: number): number {
  return base * (1 + Math.random() * 0.2);
}
