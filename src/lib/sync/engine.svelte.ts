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
  /**
   * The entities (cheque ids + the user id) to pull on every sync. The engine pulls
   * each from its stored cursor, defaulting to 0 — so a just-created/joined cheque is
   * pulled from the start without needing a pre-seeded cursor (frontend spec §4).
   */
  getActiveEntityIds: () => string[];
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
  // Observability (frontend spec — ops): surfaced to the UI status pill and any
  // metrics. lastError/lastSyncedAt are reactive; the counters are cumulative.
  #lastSyncedAt = $state<number | null>(null);
  #lastError = $state<string | null>(null);
  #syncCount = 0;
  #errorCount = 0;

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
  get lastSyncedAt(): number | null {
    return this.#lastSyncedAt;
  }
  get lastError(): string | null {
    return this.#lastError;
  }
  /** Cumulative counters for metrics/observability. */
  get metrics(): { syncCount: number; errorCount: number; backoff: number; pending: number } {
    return {
      syncCount: this.#syncCount,
      errorCount: this.#errorCount,
      backoff: this.#backoff,
      pending: this.#pending,
    };
  }
  /** Coarse status for a UI pill: offline → syncing → error → pending → synced. */
  get status(): "offline" | "error" | "syncing" | "pending" | "synced" {
    if (!this.#online) return "offline";
    if (this.#syncing) return "syncing";
    if (this.#lastError) return "error";
    if (this.#pending > 0) return "pending";
    return "synced";
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

  /** Push the outbox now and resolve with the remaining pending count (0 = fully
   *  drained). Used by logout before wiping local data so unsynced edits aren't
   *  lost. Waits out any in-flight round, then stops early if offline or a round
   *  errors / makes no progress. */
  async flush(): Promise<number> {
    for (let i = 0; i < 12 && this.#pending > 0; i++) {
      if (this.#syncing) {
        await new Promise((r) => setTimeout(r, 60));
        continue;
      }
      const before = this.#pending;
      await this.#run();
      if (this.#lastError || !this.#online || this.#pending >= before) break;
    }
    return this.#pending;
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

      // Pull every active entity from its stored cursor (default 0 → a new/joined
      // cheque is pulled from the start). Advancing #cursors keeps later pulls cheap.
      const cursors: Record<string, number> = {};
      for (const id of this.#deps.getActiveEntityIds()) {
        cursors[id] = this.#cursors[id] ?? 0;
      }

      const res = await this.#fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutations: batch, cursors }),
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
      this.#lastSyncedAt = Date.now();
      this.#lastError = null;
      this.#syncCount++;
      this.#finish(userId, false);
    } catch (err) {
      this.#lastError = err instanceof Error ? err.message : String(err);
      this.#errorCount++;
      console.error("[sync] round failed:", err, `(backoff→${this.#backoff * 2}ms)`);
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
