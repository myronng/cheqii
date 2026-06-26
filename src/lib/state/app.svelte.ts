/**
 * The reactive app hub (frontend-architecture spec §3). One `AppState` owns the
 * device clock, IndexedDB, the sync engine, and the User/Bill state machines.
 * Single source of truth: bills live in one `$state` map read via `bills.byId`,
 * no dual-copy/`updated_at` reconciliation (HLC ordering via the reducer).
 */
import { HLCClock } from "$lib/sync/clock";
import { SyncDB } from "$lib/sync/db";
import { type LogRow, SyncEngine } from "$lib/sync/engine.svelte";
import { decodeHLC, encodeHLC } from "$lib/sync/hlc";
import { type Mutation, parseMutation } from "$lib/sync/mutations";
import { uuidv7 } from "$lib/sync/uuid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getContext, setContext } from "svelte";
import { type BillData, type UserData, flattenServerBill } from "./model";
import { type AnyMutation, applyBillMutation, applyUserMutation } from "./reduce";

const APP_KEY = Symbol("app");

/** Discriminated bill-load state — never an unbounded spinner (spec §3.2). */
export type BillLoad =
  | { status: "loading" }
  | { status: "ready"; bill: BillData }
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
    bills: [],
  };
}

function emptyBill(id: string): BillData {
  return {
    id,
    name: "",
    currency: "CAD",
    visibility: "private",
    tax: 0,
    tip: 0,
    is_stub: true,
    hlc: "",
    col_hlc: {},
    updated_at: new Date().toISOString(),
    bill_contributors: [],
    bill_items: [],
    bill_item_splits: [],
    bill_users: [],
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

  async hydrate(userId: string): Promise<void> {
    this.#initialized = false;
    const stored = await this.#db?.get<UserData>("users", userId);
    this.#data = stored ?? newUserData(userId);
    if (!stored) await this.persist();
    this.#initialized = true;
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

export class BillState {
  // Single source of truth: id → live snapshot.
  #byId = $state<Record<string, BillData>>({});
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

  /** The live, reactive snapshot for a bill (UI source of truth). */
  byId(id: string): BillData | undefined {
    return this.#byId[id];
  }

  list(): BillData[] {
    return Object.values(this.#byId);
  }

  /** Load all known bills from IDB into memory (boot). */
  async hydrate(ids: string[]): Promise<void> {
    this.#initialized = false;
    for (const id of ids) {
      const stored = await this.#db?.get<BillData>("bills", id);
      if (stored) this.#byId[id] = stored;
    }
    this.#initialized = true;
  }

  /** Replace a snapshot wholesale (e.g. a server fetch / SNAPSHOT). */
  ingest(bill: BillData): void {
    this.#byId[bill.id] = bill;
  }

  /** Apply a mutation to the bill's snapshot in place via the convergence reducer. */
  apply(billId: string, m: AnyMutation): void {
    const bill = (this.#byId[billId] ??= emptyBill(billId));
    applyBillMutation(bill, m);
  }

  async persist(billId: string): Promise<void> {
    const bill = this.#byId[billId];
    if (bill && this.#db) await this.#db.put("bills", $state.snapshot(bill));
  }

  remove(billId: string): void {
    delete this.#byId[billId];
  }

  async deleteLocal(billId: string): Promise<void> {
    this.remove(billId);
    await this.#db?.delete("bills", billId);
  }

  /**
   * Resolve a bill to a discriminated state (spec §3.2): local first, else fetch.
   * 403/404 → purge + not_found; network/other → error (caller can retry/show banner).
   */
  async ensureLoaded(id: string): Promise<BillLoad> {
    if (this.#byId[id]) return { status: "ready", bill: this.#byId[id] };
    const stored = await this.#db?.get<BillData>("bills", id);
    if (stored) {
      this.#byId[id] = stored;
      return { status: "ready", bill: stored };
    }
    try {
      const res = await this.#fetch(`/api/bills/${id}`);
      if (res.status === 403 || res.status === 404) {
        await this.deleteLocal(id);
        return { status: "not_found" };
      }
      if (!res.ok) return { status: "error" };
      const bill = flattenServerBill(await res.json());
      this.ingest(bill);
      await this.persist(id);
      return { status: "ready", bill };
    } catch {
      return { status: "error" };
    }
  }
}

export class AppState {
  user: UserState;
  bills: BillState;
  sync: SyncEngine | null = $state(null);

  #db: SyncDB | null = null;
  #clock: HLCClock | null = null;
  #userId = $state<string | undefined>(undefined);
  #booted = $state(false);
  readonly #supabase: SupabaseClient;

  // Getter (not a $derived field) so it can read user/bills, which are assigned
  // in the constructor after field initializers run. Still reactive — it reads $state.
  get initialized(): boolean {
    return this.#booted && this.user.initialized && this.bills.initialized;
  }

  constructor(supabase: SupabaseClient) {
    this.#supabase = supabase;
    this.user = new UserState();
    this.bills = new BillState();
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
    this.bills.attach(this.#db);

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
        onIncoming: (rows) => this.applyIncoming(rows),
        fetchFn: fetch,
      });
    }

    const {
      data: { user },
    } = await this.#supabase.auth.getUser();
    await this.#setUser(user?.id);
    this.#booted = true;
  }

  async #setUser(userId: string | undefined): Promise<void> {
    this.#userId = userId;
    if (userId) {
      await this.user.hydrate(userId);
      await this.bills.hydrate(this.user.data?.bills ?? []);
    } else {
      this.user.clear();
      await this.bills.hydrate([]);
    }
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

  /** Reduce pulled peer mutations into local snapshots, then persist touched bills. */
  async applyIncoming(rows: LogRow[]): Promise<void> {
    const touchedBills = new Set<string>();
    for (const row of rows) {
      let m: Mutation;
      try {
        m = parseMutation(row);
      } catch {
        continue; // skip anything that doesn't validate
      }
      const am = m as AnyMutation;
      if (am.type === "DELETE_BILL") {
        await this.#onRemoteDeleteBill(am.entity_id);
        continue;
      }
      if (am.type === "UPDATE_USER" || am.type === "DELETE_USER") {
        if (this.user.data && am.entity_id === this.user.data.id) {
          applyUserMutation(this.user.data, am);
          await this.user.persist();
        }
        continue;
      }
      this.bills.apply(am.entity_id, am);
      touchedBills.add(am.entity_id);
    }
    for (const billId of touchedBills) await this.bills.persist(billId);
  }

  async #onRemoteDeleteBill(billId: string): Promise<void> {
    await this.bills.deleteLocal(billId);
    if (this.user.data?.bills.includes(billId)) {
      this.user.set({
        ...this.user.data,
        bills: this.user.data.bills.filter((id) => id !== billId),
      });
      await this.user.persist();
    }
  }

  /** Watch Supabase auth and re-resolve identity. Call inside an `$effect`. */
  watchAuth(): () => void {
    const {
      data: { subscription },
    } = this.#supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        void this.#supabase.auth.getUser().then(({ data }) => this.#setUser(data.user?.id));
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
