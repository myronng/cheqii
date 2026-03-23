import { idb } from "$lib/utils/common/indexedDb.svelte";

import type { Mutation, MutationType } from "$lib/utils/models/types";

// Redundant interface removed as it is imported.

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
  apply(mutation: Mutation): void;
  sync(): Promise<void>;
}

export type OnIncomingMutations = (mutations: Mutation[]) => Promise<void>;

export class SyncState implements ISyncState {
  #syncing = $state(false);
  #outbox = $state<Mutation[]>([]);
  #sync_seq_id = $state(0);
  #retryDelay = 1000;
  #maxRetryDelay = 128000;
  #timeoutId: ReturnType<typeof setTimeout> | null = null;
  #getUserId: () => string | undefined;
  #onIncomingMutations: OnIncomingMutations;

  constructor(getUserId: () => string | undefined, onIncomingMutations: OnIncomingMutations) {
    this.#getUserId = getUserId;
    this.#onIncomingMutations = onIncomingMutations;
    this.#initialize();
  }

  get isSyncing() {
    return this.#syncing;
  }

  get pendingCount() {
    return this.#outbox.length;
  }

  async #initialize() {
    await this.#loadOutbox();
    await this.#loadSyncMeta();
  }

  async #loadOutbox() {
    if (!idb) return;
    const mutations = await idb.getAll<Mutation>("outbox");
    if (mutations) {
      this.#outbox = mutations.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      this.sync();
    }
  }

  async #loadSyncMeta() {
    if (!idb) return;
    const userId = this.#getUserId();
    if (!userId) return;

    const meta = await idb.get<{ user_id: string; sync_seq_id: number }>("metadata", userId);
    if (meta) {
      this.#sync_seq_id = meta.sync_seq_id;
    }
  }

  apply(mutation: Mutation) {
    this.#outbox.push(mutation);
    this.sync();
  }

  async sync() {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }

    if (this.#syncing) return;

    const userId = this.#getUserId();
    if (userId === undefined) {
      return;
    }

    const userMutations = this.#outbox.filter((m) => m.user_id === userId);

    this.#syncing = true;

    try {
      const response = await fetch("/api/sync", {
        body: JSON.stringify({
          mutations: userMutations,
          sync_seq_id: this.#sync_seq_id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Sync failed");
      }

      const { processedIds, newMutations, latest_sync_seq_id } = (await response.json()) as {
        processedIds: string[];
        newMutations: Mutation[];
        latest_sync_seq_id: number;
      };

      // Progress made?
      this.#retryDelay = 1000;

      // 1. Remove processed mutations
      if (processedIds.length > 0) {
        if (idb) {
          await Promise.all(processedIds.map((id) => idb?.delete("outbox", id)));
        }
        this.#outbox = this.#outbox.filter((m) => !processedIds.includes(m.id));
      }

      // 2. Apply incoming mutations from other users/devices
      if (newMutations.length > 0) {
        const relevantMutations = newMutations.filter((m) => !processedIds.includes(m.id));
        if (relevantMutations.length > 0) {
          await this.#onIncomingMutations(relevantMutations);
        }
      }

      // 3. Update checkpoint
      if (latest_sync_seq_id > this.#sync_seq_id) {
        this.#sync_seq_id = latest_sync_seq_id;
        if (idb) {
          await idb.put("metadata", {
            user_id: userId,
            sync_seq_id: latest_sync_seq_id,
          });
        }
      }
    } catch (err) {
      console.error("Sync error:", err);
      this.#retryDelay = Math.min(this.#retryDelay * 2, this.#maxRetryDelay);
    } finally {
      this.#syncing = false;
      if (this.#outbox.length > 0) {
        const jitteredDelay = this.#retryDelay * (1 + Math.random() * 0.2);
        this.#timeoutId = setTimeout(() => this.sync(), jitteredDelay);
      }
    }
  }
}
