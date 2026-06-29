/**
 * Client persistence (IndexedDB). The denormalized `cheques`/`users` snapshots are
 * the UI source of truth; `outbox` holds pending mutations; `cursors` track the
 * per-entity pull checkpoint; `meta` holds device/clock state.
 *
 * The schema version is *derived* from the migration list length, so the version
 * can never drift from its upgrade blocks (the v1 trap — sync spec §9/§6).
 * See docs/sync-engine-spec.md §1, §3, §9.
 */
import type { Mutation } from "./mutations";

export type StoreName = "cheques" | "users" | "outbox" | "cursors" | "meta";

/** A snapshot write paired with a mutation, committed atomically. */
export interface SnapshotWrite {
  store: "cheques" | "users";
  /** `put` this value, or — when omitted — `delete` the key. */
  value?: unknown;
  /** Required when deleting (value omitted). */
  key?: IDBValidKey;
}

export interface CursorRecord {
  entity_id: string;
  seq_id: number;
}

interface MetaRecord {
  key: string;
  value: unknown;
}

const DB_NAME = "cheqii";

/**
 * Ordered, append-only migration list. To change the schema, push a new entry —
 * never edit an existing one. `DB_VERSION` follows automatically.
 */
const MIGRATIONS: Array<(db: IDBDatabase) => void> = [
  // v1 — denormalized snapshots.
  (db) => {
    db.createObjectStore("bills", { keyPath: "id" });
    db.createObjectStore("users", { keyPath: "id" });
  },
  // v2 — pending mutation outbox, indexed by HLC for ordered flush.
  (db) => {
    db.createObjectStore("outbox", { keyPath: "id" }).createIndex("hlc", "hlc");
  },
  // v3 — per-entity pull cursors + device/clock metadata.
  (db) => {
    db.createObjectStore("cursors", { keyPath: "entity_id" });
    db.createObjectStore("meta", { keyPath: "key" });
  },
  // v4 — domain rename bills→cheques. The server is the source of truth, so we
  // recreate the snapshot store empty and let the engine re-pull rather than copy
  // rows; existing installs drop their stale "bills" cache here.
  (db) => {
    if (!db.objectStoreNames.contains("cheques")) {
      db.createObjectStore("cheques", { keyPath: "id" });
    }
    if (db.objectStoreNames.contains("bills")) {
      db.deleteObjectStore("bills");
    }
  },
  // v5 — field rename contributor→person inside cheque snapshots + the wire
  // protocol (cheque_contributors→cheque_people, contributor_id→person_id,
  // *_CONTRIBUTOR mutation types→*_PERSON). The cached snapshots, any queued
  // mutations, and the pull cursors all carry the old shape, so we drop and
  // recreate these re-derivable stores and let the engine re-pull from the
  // server (the source of truth). `users`/`meta` carry no person fields → kept.
  (db) => {
    for (const store of ["cheques", "outbox", "cursors"] as const) {
      if (db.objectStoreNames.contains(store)) db.deleteObjectStore(store);
    }
    db.createObjectStore("cheques", { keyPath: "id" });
    db.createObjectStore("outbox", { keyPath: "id" }).createIndex("hlc", "hlc");
    db.createObjectStore("cursors", { keyPath: "entity_id" });
  },
];

export const DB_VERSION = MIGRATIONS.length;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export class SyncDB {
  #db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.#db = db;
  }

  /** `null` when IndexedDB is unavailable (SSR / unsupported), so callers no-op. */
  static async open(name = DB_NAME): Promise<SyncDB | null> {
    if (typeof indexedDB === "undefined") return null;
    const request = indexedDB.open(name, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      // Run only the migrations the stored version hasn't seen yet.
      for (let v = e.oldVersion; v < MIGRATIONS.length; v++) {
        MIGRATIONS[v](db);
      }
    };
    const db = await promisify(request);
    // Another tab upgraded the schema — release our handle so it isn't blocked.
    db.onversionchange = () => db.close();
    return new SyncDB(db);
  }

  /** Release this connection so a pending delete/upgrade isn't blocked. */
  close(): void {
    this.#db.close();
  }

  /** Delete the entire database (all local data — cheques, outbox, cursors, the
   *  user record, and device meta). Best-effort: resolves even if a lingering
   *  connection blocks it, since the only caller (logout) reloads right after. */
  static deleteDatabase(name = DB_NAME): Promise<void> {
    if (typeof indexedDB === "undefined") return Promise.resolve();
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }

  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return promisify(this.#db.transaction(store, "readonly").objectStore(store).get(key));
  }

  getAll<T>(store: StoreName): Promise<T[]> {
    return promisify(this.#db.transaction(store, "readonly").objectStore(store).getAll());
  }

  put(store: StoreName, value: unknown): Promise<IDBValidKey> {
    return promisify(this.#db.transaction(store, "readwrite").objectStore(store).put(value));
  }

  delete(store: StoreName, key: IDBValidKey): Promise<undefined> {
    return promisify(this.#db.transaction(store, "readwrite").objectStore(store).delete(key));
  }

  /**
   * Atomically apply a local edit and enqueue its mutation: the snapshot write
   * and the outbox put share one transaction, so we can never persist state
   * without queuing the mutation that produced it (sync spec §3).
   */
  commitMutation(write: SnapshotWrite | null, mutation: Mutation): Promise<void> {
    const stores: StoreName[] = write ? [write.store, "outbox"] : ["outbox"];
    const tx = this.#db.transaction(stores, "readwrite");
    if (write) {
      const store = tx.objectStore(write.store);
      if (write.value !== undefined) {
        store.put(write.value);
      } else if (write.key !== undefined) {
        store.delete(write.key);
      }
    }
    tx.objectStore("outbox").put(mutation);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("commitMutation transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("commitMutation transaction aborted"));
    });
  }

  /** All pending mutations (the engine sorts them by HLC before flushing). */
  loadOutbox(): Promise<Mutation[]> {
    return this.getAll<Mutation>("outbox");
  }

  /** Remove flushed mutations from the outbox (idempotent). */
  async clearOutbox(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const tx = this.#db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    for (const id of ids) store.delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("clearOutbox failed"));
    });
  }

  async getCursors(): Promise<Record<string, number>> {
    const rows = await this.getAll<CursorRecord>("cursors");
    return Object.fromEntries(rows.map((r) => [r.entity_id, r.seq_id]));
  }

  setCursor(entity_id: string, seq_id: number): Promise<IDBValidKey> {
    return this.put("cursors", { entity_id, seq_id } satisfies CursorRecord);
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const row = await this.get<MetaRecord>("meta", key);
    return row?.value as T | undefined;
  }

  setMeta(key: string, value: unknown): Promise<IDBValidKey> {
    return this.put("meta", { key, value } satisfies MetaRecord);
  }
}
