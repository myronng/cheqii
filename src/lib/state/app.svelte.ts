/**
 * The reactive app hub (frontend-architecture spec §3). One `AppState` owns the
 * device clock, IndexedDB, the sync engine, and the User/Cheque state machines.
 * Single source of truth: cheques live in one `$state` map read via `cheques.byId`,
 * no dual-copy/`updated_at` reconciliation (HLC ordering via the reducer).
 */
import { HLCClock } from "$lib/sync/clock";
import { SyncDB } from "$lib/sync/db";
import { type LogRow, SyncEngine } from "$lib/sync/engine.svelte";
import { decodeHLC, encodeHLC } from "$lib/sync/hlc";
import { attachLiveness } from "$lib/sync/liveness";
import { type Mutation, parseMutation } from "$lib/sync/mutations";
import { uuidv7 } from "$lib/sync/uuid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getContext, setContext } from "svelte";
import { type ChequeData, type UserData, flattenServerCheque } from "./model";
import { type AnyMutation, applyChequeMutation, applyUserMutation } from "./reduce";

const APP_KEY = Symbol("app");

/** Discriminated cheque-load state — never an unbounded spinner (spec §3.2). */
export type ChequeLoad =
  | { status: "loading" }
  | { status: "ready"; cheque: ChequeData }
  | { status: "not_found" }
  | { status: "error" };

function newUserData(id: string): UserData {
  return {
    id,
    default_visibility: "private",
    default_payment_id: null,
    default_payment_method: "etransfer",
    hlc: "",
    col_hlc: {},
    updated_at: new Date().toISOString(),
    cheques: [],
  };
}

function emptyCheque(id: string): ChequeData {
  return {
    id,
    name: "",
    visibility: "private",
    is_stub: true,
    hlc: "",
    col_hlc: {},
    updated_at: new Date().toISOString(),
    cheque_people: [],
    cheque_items: [],
    cheque_item_splits: [],
    cheque_users: [],
  };
}

export class UserState {
  #data = $state<UserData | null>(null);
  #initialized = $state(false);
  #db: SyncDB | null;

  constructor(db: SyncDB | null = null) {
    this.#db = db;
  }

  get data(): UserData | null {
    return this.#data;
  }
  get initialized(): boolean {
    return this.#initialized;
  }

  attach(db: SyncDB | null): void {
    this.#db = db;
  }

  /** Returns whether a local record already existed (false ⇒ fresh device or
   *  evicted storage — the caller re-hydrates from the server). */
  async hydrate(userId: string): Promise<boolean> {
    this.#initialized = false;
    const stored = await this.#db?.get<UserData>("users", userId);
    this.#data = stored ?? newUserData(userId);
    if (!stored) await this.persist();
    this.#initialized = true;
    return !!stored;
  }

  clear(): void {
    this.#data = null;
    this.#initialized = true;
  }

  /** Mutate the in-memory record (the caller persists + enqueues the mutation). */
  set(data: UserData): void {
    this.#data = data;
  }

  async persist(): Promise<void> {
    if (this.#data && this.#db) await this.#db.put("users", $state.snapshot(this.#data));
  }
}

export class ChequeState {
  // Single source of truth: id → live snapshot.
  #byId = $state<Record<string, ChequeData>>({});
  #initialized = $state(false);
  #db: SyncDB | null;
  readonly #fetch: typeof fetch;

  constructor(db: SyncDB | null = null, fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.#db = db;
    this.#fetch = fetchFn;
  }

  attach(db: SyncDB | null): void {
    this.#db = db;
  }

  get initialized(): boolean {
    return this.#initialized;
  }

  /** The live, reactive snapshot for a cheque (UI source of truth). */
  byId(id: string): ChequeData | undefined {
    return this.#byId[id];
  }

  list(): ChequeData[] {
    return Object.values(this.#byId);
  }

  /** Load all known cheques from IDB into memory (boot). */
  async hydrate(ids: string[]): Promise<void> {
    this.#initialized = false;
    for (const id of ids) {
      const stored = await this.#db?.get<ChequeData>("cheques", id);
      if (stored) this.#byId[id] = stored;
    }
    this.#initialized = true;
  }

  /** Replace a snapshot wholesale (e.g. a server fetch / SNAPSHOT). */
  ingest(cheque: ChequeData): void {
    this.#byId[cheque.id] = cheque;
  }

  /** Apply a mutation to the cheque's snapshot in place via the convergence reducer. */
  apply(chequeId: string, m: AnyMutation): void {
    const cheque = (this.#byId[chequeId] ??= emptyCheque(chequeId));
    applyChequeMutation(cheque, m);
  }

  async persist(chequeId: string): Promise<void> {
    const cheque = this.#byId[chequeId];
    if (cheque && this.#db) await this.#db.put("cheques", $state.snapshot(cheque));
  }

  remove(chequeId: string): void {
    delete this.#byId[chequeId];
  }

  async deleteLocal(chequeId: string): Promise<void> {
    this.remove(chequeId);
    await this.#db?.delete("cheques", chequeId);
  }

  /**
   * Resolve a cheque to a discriminated state (spec §3.2): local first, else fetch.
   * 403/404 → purge + not_found; network/other → error (caller can retry/show banner).
   */
  async ensureLoaded(id: string): Promise<ChequeLoad> {
    if (this.#byId[id]) return { status: "ready", cheque: this.#byId[id] };
    const stored = await this.#db?.get<ChequeData>("cheques", id);
    if (stored) {
      this.#byId[id] = stored;
      return { status: "ready", cheque: stored };
    }
    try {
      const res = await this.#fetch(`/api/cheques/${id}`);
      if (res.status === 403 || res.status === 404) {
        await this.deleteLocal(id);
        return { status: "not_found" };
      }
      if (!res.ok) return { status: "error" };
      const cheque = flattenServerCheque(await res.json());
      this.ingest(cheque);
      await this.persist(id);
      return { status: "ready", cheque };
    } catch {
      return { status: "error" };
    }
  }
}

export class AppState {
  user: UserState;
  cheques: ChequeState;
  sync: SyncEngine | null = $state(null);
  // Storage durability (frontend spec §3.6a). `persisted` false ⇒ the browser may
  // evict IndexedDB under pressure / after inactivity → the UI nudges installing.
  storage = $state<{ persisted: boolean; usage: number; quota: number } | null>(null);

  #db: SyncDB | null = null;
  #clock: HLCClock | null = null;
  #userId = $state<string | undefined>(undefined);
  #booted = $state(false);
  #detachLiveness: (() => void) | null = null;
  readonly #supabase: SupabaseClient;

  // Only the FIRST boot gates the UI. `#booted` latches true after the initial
  // hydrate (which already awaits user + cheques) and never flips back. We must
  // NOT also gate on user/cheques.initialized: re-resolving identity on every
  // sign-in/out re-hydrates those (toggling their `initialized` false→true), and
  // gating on them would unmount + remount every app child on each auth change —
  // which re-fired /new's create effect and produced duplicate cheques.
  get initialized(): boolean {
    return this.#booted;
  }

  constructor(supabase: SupabaseClient) {
    this.#supabase = supabase;
    this.user = new UserState();
    this.cheques = new ChequeState();
    void this.#boot();
  }

  /** Stable per-device clock; node id + last HLC persisted in `meta`. */
  get clock(): HLCClock {
    if (!this.#clock) throw new Error("AppState not booted");
    return this.#clock;
  }
  get db(): SyncDB | null {
    return this.#db;
  }

  /** Async boot (kicked off from the constructor): open IDB, clock, engine,
   *  identity, local hydrate. `initialized` stays false until this completes. */
  async #boot(): Promise<void> {
    this.#db = await SyncDB.open();
    this.user.attach(this.#db);
    this.cheques.attach(this.#db);

    // Storage durability (frontend spec §3.6a): ask for persistent storage so the
    // outbox/snapshots are exempt from eviction-under-pressure, and record health
    // so the UI can warn when the browser may still evict our data.
    const persisted = (await navigator?.storage?.persist?.().catch(() => false)) ?? false;
    const est = await navigator?.storage?.estimate?.().catch(() => null);
    this.storage = { persisted, usage: est?.usage ?? 0, quota: est?.quota ?? 0 };

    let nodeId = await this.#db?.getMeta<string>("node_id");
    if (!nodeId) {
      nodeId = uuidv7();
      await this.#db?.setMeta("node_id", nodeId);
    }
    const lastHlc = await this.#db?.getMeta<string>("hlc");
    this.#clock = new HLCClock(nodeId, lastHlc ? { initial: decodeHLC(lastHlc) } : undefined);

    if (this.#db) {
      this.sync = new SyncEngine({
        db: this.#db,
        clock: this.#clock,
        getUserId: () => this.#userId,
        // Pull all known cheques + the user's own record on every sync.
        getActiveEntityIds: () => {
          const ids = this.cheques.list().map((b) => b.id);
          if (this.user.data) ids.push(this.user.data.id);
          return ids;
        },
        onIncoming: (rows) => this.applyIncoming(rows),
        fetchFn: fetch,
      });
      // Liveness: Realtime(mutation_logs) + visibility/online + heartbeat → pull,
      // so an idle device receives peers' edits without making one first (sync §4).
      this.#detachLiveness = attachLiveness(this.sync, this.#supabase);
    }

    // Identity from the LOCAL session (offline-safe). getUser() hits the network to
    // validate the JWT and returns no user when offline — which would clear a valid
    // session and bounce the app to /auth in an infinite loop (the gate would see no
    // user while /auth still sees the local session). getSession() reads storage.
    const {
      data: { session },
    } = await this.#supabase.auth.getSession();
    await this.#setUser(session?.user?.id);
    this.#booted = true;
  }

  async #setUser(userId: string | undefined): Promise<void> {
    this.#userId = userId;
    if (userId) {
      const hadLocal = await this.user.hydrate(userId);
      await this.cheques.hydrate(this.user.data?.cheques ?? []);
      // Eviction / fresh-device recovery (frontend spec §3.6a, acceptance #234):
      // local storage came up empty but the session is valid → the server is the
      // recoverable source; re-pull membership so we never present an empty app as
      // truth. Runs before `initialized` flips true, so the UI shows boot, not a void.
      if (!hadLocal || this.cheques.list().length === 0) {
        await this.#recoverFromServer(userId);
      }
    } else {
      this.user.clear();
      await this.cheques.hydrate([]);
    }
  }

  /** Re-pull the user's cheques from Supabase into the local store (RLS scopes to
   *  membership). Used when IndexedDB was evicted or this is a fresh device. */
  async #recoverFromServer(userId: string): Promise<void> {
    const { data, error } = await this.#supabase
      .from("cheque_users")
      .select("cheque_id")
      .eq("user_id", userId);
    if (error || !data?.length) return;
    const ids = data.map((r) => r.cheque_id);
    for (const id of ids) {
      if (!this.cheques.byId(id)) await this.cheques.ensureLoaded(id);
    }
    // Record the recovered ids on the local user record so later boots hydrate them.
    if (this.user.data) {
      const merged = Array.from(new Set([...this.user.data.cheques, ...ids]));
      this.user.set({ ...this.user.data, cheques: merged });
      await this.user.persist();
    }
  }

  /** Tear down liveness listeners/subscription (call on context teardown). */
  dispose(): void {
    this.#detachLiveness?.();
    this.#detachLiveness = null;
  }

  /** Wipe all local data (logout). Detaches liveness, releases the IndexedDB
   *  handle, and deletes the database — cheques, outbox, cursors, the user record,
   *  and device meta all go. The caller is expected to reload immediately after. */
  async wipeLocalData(): Promise<void> {
    this.dispose();
    this.#db?.close();
    this.#db = null;
    await SyncDB.deleteDatabase();
  }

  /** Re-read the current identity and hydrate (used right after a fresh sign-in). */
  async resolveIdentity(): Promise<void> {
    const {
      data: { user },
    } = await this.#supabase.auth.getUser();
    await this.#setUser(user?.id);
  }

  /** Persist the clock so it stays monotonic across reloads (call after a tick). */
  async persistClock(): Promise<void> {
    if (this.#clock) await this.#db?.setMeta("hlc", encodeHLC(this.#clock.state));
  }

  /** Reduce pulled peer mutations into local snapshots, then persist touched cheques. */
  async applyIncoming(rows: LogRow[]): Promise<void> {
    const touchedCheques = new Set<string>();
    for (const row of rows) {
      let m: Mutation;
      try {
        m = parseMutation(row);
      } catch {
        continue; // skip anything that doesn't validate
      }
      const am = m as AnyMutation;
      if (am.type === "DELETE_CHEQUE") {
        await this.#onRemoteDeleteCheque(am.entity_id);
        continue;
      }
      if (am.type === "UPDATE_USER" || am.type === "DELETE_USER") {
        if (this.user.data && am.entity_id === this.user.data.id) {
          applyUserMutation(this.user.data, am);
          await this.user.persist();
        }
        continue;
      }
      this.cheques.apply(am.entity_id, am);
      touchedCheques.add(am.entity_id);
    }
    for (const chequeId of touchedCheques) await this.cheques.persist(chequeId);
  }

  async #onRemoteDeleteCheque(chequeId: string): Promise<void> {
    await this.cheques.deleteLocal(chequeId);
    if (this.user.data?.cheques.includes(chequeId)) {
      this.user.set({
        ...this.user.data,
        cheques: this.user.data.cheques.filter((id) => id !== chequeId),
      });
      await this.user.persist();
    }
  }

  /** Watch Supabase auth and re-resolve identity. Call inside an `$effect`. */
  watchAuth(): () => void {
    const {
      data: { subscription },
    } = this.#supabase.auth.onAuthStateChange((event, session) => {
      // Use the session from the event (offline-safe) rather than a network getUser().
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        void this.#setUser(session?.user?.id);
      }
    });
    return () => subscription.unsubscribe();
  }
}

/** Construct an AppState (boots itself in the background) and put it in context. */
export function createAppContext(supabase: SupabaseClient): AppState {
  const app = new AppState(supabase);
  setContext(APP_KEY, app);
  return app;
}

export function getAppContext(): AppState {
  return getContext<AppState>(APP_KEY);
}
