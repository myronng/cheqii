import { invalidate } from "$app/navigation";
import { idb } from "$lib/utils/common/indexedDb.svelte";

export type MutationType =
  | "CREATE_BILL"
  | "UPDATE_BILL"
  | "DELETE_BILL"
  | "ADD_CONTRIBUTOR"
  | "UPDATE_CONTRIBUTOR"
  | "DELETE_CONTRIBUTOR"
  | "ADD_ITEM"
  | "UPDATE_ITEM"
  | "DELETE_ITEM"
  | "ADD_SPLIT"
  | "UPDATE_SPLIT"
  | "LEAVE_BILL"
  | "UPDATE_USER";

export interface Mutation {
  created_at: string;
  entity_id: string;
  id: string;
  payload: any;
  type: MutationType;
  user_id: string;
}

export const createMutation = (
  type: MutationType,
  payload: any,
  entity_id: string,
  user_id: string,
): Mutation => ({
  created_at: new Date().toISOString(),
  entity_id,
  id: crypto.randomUUID(),
  payload,
  type,
  user_id,
});

export interface ISyncState {
  readonly isSyncing: boolean;
  readonly pendingCount: number;
  push(mutation: Mutation): Promise<void>;
  sync(): Promise<void>;
}

export class SyncState implements ISyncState {
  #syncing = $state(false);
  #outbox = $state<Mutation[]>([]);
  #retryDelay = 1000;
  #maxRetryDelay = 128000;
  #timeoutId: ReturnType<typeof setTimeout> | null = null;
  #getUserId: () => string | undefined;

  constructor(getUserId: () => string | undefined) {
    this.#getUserId = getUserId;
    this.#loadOutbox();
  }

  get isSyncing() {
    return this.#syncing;
  }

  get pendingCount() {
    return this.#outbox.length;
  }

  async #loadOutbox() {
    if (!idb) return;
    const mutations = await idb.getAll<Mutation>("outbox");
    if (mutations) {
      this.#outbox = mutations.sort(
        (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
      );
      this.sync();
    }
  }

  async push(mutation: Mutation) {
    if (!idb) {
      console.warn("IndexedDB not available, mutation not persisted safely.");
    } else {
      await idb.put("outbox", mutation);
    }
    this.#outbox.push(mutation);
    this.sync();
  }

  async sync() {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }

    if (this.#syncing || this.#outbox.length === 0) return;

    if (this.#getUserId() === undefined) {
      return;
    }

    const userMutations = this.#outbox.filter(
      (m) => m.user_id === this.#getUserId(),
    );
    if (userMutations.length === 0) return;

    this.#syncing = true;

    try {
      const response = await fetch("/api/sync", {
        body: JSON.stringify({ mutations: userMutations }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Sync failed");
      }

      const result = await response.json();
      const processedIds = result.processedIds as string[];

      // Reset backoff on any progress (even partial)
      this.#retryDelay = 1000;

      // Remove processed mutations from local IDB and state
      if (idb) {
        await Promise.all(processedIds.map((id) => idb?.delete("outbox", id)));
      }

      this.#outbox = this.#outbox.filter((m) => !processedIds.includes(m.id));

      // Trigger a re-fetch of data to ensure server truth
      await invalidate("supabase:db:bills");
    } catch (err) {
      console.error("Sync error:", err);
      // Double delay on failure, up to max
      this.#retryDelay = Math.min(this.#retryDelay * 2, this.#maxRetryDelay);
    } finally {
      this.#syncing = false;
      // If we still have items, try again (maybe partial success or new items added)
      if (this.#outbox.length > 0) {
        const jitteredDelay = this.#retryDelay * (1 + Math.random() * 0.2);
        this.#timeoutId = setTimeout(() => this.sync(), jitteredDelay); // Retry with jittered backoff
      }
    }
  }
}
