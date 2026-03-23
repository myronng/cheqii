import type { Mutation } from "$lib/utils/models/types";

type IndexedDBResult = {
  idb: IDBDatabase;
  idbDelete: (storeName: string, key: IDBKeyRange | IDBValidKey) => Promise<IDBRequest["result"]>;
  idbGet: <T>(
    storeName: string,
    key: IDBKeyRange | IDBValidKey,
  ) => Promise<IDBRequest<T>["result"]>;
  idbGetAll: <T>(
    storeName: string,
    key?: IDBKeyRange | IDBValidKey,
    count?: number,
  ) => Promise<IDBRequest<T[]>["result"]>;
  // Any JS primitive/non-primitive can be stored in IDB
  idbPut: (storeName: string, value: unknown, key?: IDBValidKey) => Promise<IDBRequest["result"]>;
  idbCommitMutation: <T>(
    storeName: string,
    value: T | null,
    mutation: Mutation,
    key?: IDBValidKey,
  ) => Promise<void>;
};

const DB_NAME = "cheqii";
const DB_VERSION = 3; // Incremented for metadata

const openIndexedDb = (dbVersion = DB_VERSION, dbName = DB_NAME) =>
  new Promise<IndexedDBResult | null>((resolve, reject) => {
    if (typeof indexedDB !== "undefined") {
      const request = indexedDB.open(dbName, dbVersion);

      request.onerror = (e) => {
        const error = (e.currentTarget as IDBOpenDBRequest).error;
        reject(new Error(error?.message, { cause: error }));
      };

      request.onsuccess = (e) => {
        const currentIdb = (e.currentTarget as IDBOpenDBRequest).result;

        currentIdb.onversionchange = (eVersionChange) => {
          const idbVersionChange = e.currentTarget as IDBDatabase;
          idbVersionChange.close();

          if (typeof eVersionChange.newVersion === "number") {
            openIndexedDb(eVersionChange.newVersion);
          }
        };

        resolve({
          idb: currentIdb,
          idbDelete: (storeName, key) =>
            new Promise((resolveDelete, rejectDelete) => {
              const transaction = currentIdb.transaction(storeName, "readwrite");
              const store = transaction.objectStore(storeName);
              const deleteRequest = store.delete(key);

              deleteRequest.onerror = (eDelete) => {
                const error = (eDelete.currentTarget as IDBRequest).error;
                rejectDelete(new Error(error?.message, { cause: error }));
              };

              deleteRequest.onsuccess = (eDelete) => {
                const result = (eDelete.currentTarget as IDBRequest).result;
                resolveDelete(result);
              };
            }),
          idbGet: (storeName, key) =>
            new Promise((resolveGet, rejectGet) => {
              const transaction = currentIdb.transaction(storeName, "readonly");
              const store = transaction.objectStore(storeName);
              const getRequest = store.get(key);

              getRequest.onerror = (eGet) => {
                const error = (eGet.currentTarget as IDBRequest).error;
                rejectGet(new Error(error?.message, { cause: error }));
              };

              getRequest.onsuccess = (eGet) => {
                const result = (eGet.currentTarget as IDBRequest).result;
                resolveGet(result);
              };
            }),
          idbGetAll: (storeName, key, count) =>
            new Promise((resolveGet, rejectGet) => {
              const transaction = currentIdb.transaction(storeName, "readonly");
              const store = transaction.objectStore(storeName);
              const getRequest = store.getAll(key, count);

              getRequest.onerror = (eGet) => {
                const error = (eGet.currentTarget as IDBRequest).error;
                rejectGet(new Error(error?.message, { cause: error }));
              };

              getRequest.onsuccess = (eGet) => {
                const result = (eGet.currentTarget as IDBRequest).result;
                resolveGet(result);
              };
            }),
          idbPut: (storeName, value, key) =>
            new Promise((resolvePut, rejectPut) => {
              const transaction = currentIdb.transaction(storeName, "readwrite");
              const store = transaction.objectStore(storeName);
              const putRequest = store.put(value, key);

              putRequest.onerror = (ePut) => {
                const error = (ePut.currentTarget as IDBRequest).error;
                rejectPut(new Error(error?.message, { cause: error }));
              };

              putRequest.onsuccess = (ePut) => {
                const result = (ePut.currentTarget as IDBRequest).result;
                resolvePut(result);
              };
            }),
          idbCommitMutation: (storeName, value, mutation, key) =>
            new Promise((resolveCommit, rejectCommit) => {
              const transaction = currentIdb.transaction([storeName, "outbox"], "readwrite");

              const store = transaction.objectStore(storeName);

              // Smart Delete Logic:
              // If value is null, OR mutation type implies specific deletion, we delete.
              // Note: For BILL deletions, mutation.entity_id is the bill id.
              // For other entities, we rely on the key being passed or value being null.
              if (value === null || mutation.type.startsWith("DELETE_")) {
                // Use key if provided, otherwise assume mutation.entity_id IS the key for top-level entities
                // However, for items/contributors, the key might differ.
                // For safety in this specific app architecture:
                // - DELETE_BILL -> key = mutation.entity_id
                // - DELETE_ITEM -> key = mutation.entity_id (since we store bills, this is complex. Actually we store BILLS.)
                // Wait, we store BILL objects. So deleting an item is an UPDATE to the bill.
                // So actually, DELETE only happens for bills and users.
                if (
                  mutation.type === "DELETE_BILL" ||
                  mutation.type === "DELETE_USER" ||
                  mutation.type === "LEAVE_BILL"
                ) {
                  store.delete(mutation.entity_id);
                } else if (value === null && key) {
                  store.delete(key);
                } else if (value !== null) {
                  store.put(value, key);
                }
              } else {
                store.put(value, key);
              }

              const outbox = transaction.objectStore("outbox");
              outbox.put(mutation);

              transaction.oncomplete = () => {
                resolveCommit();
              };

              transaction.onerror = (e) => {
                const target = e.target as IDBRequest;
                rejectCommit(
                  new Error(target.error?.message || "Transaction failed", {
                    cause: target.error,
                  }),
                );
              };
            }),
        });
      };

      request.onupgradeneeded = (e) => {
        const idb = (e.currentTarget as IDBOpenDBRequest).result;
        if (typeof e.newVersion === "number") {
          if (e.newVersion <= 1) {
            idb.createObjectStore("bills", { keyPath: "id" });
            idb.createObjectStore("users", { keyPath: "id" });
          }
          if (e.newVersion <= 2) {
            const outboxStore = idb.createObjectStore("outbox", {
              keyPath: "id",
            });
            outboxStore.createIndex("created_at", "created_at");
          }
          if (e.newVersion <= 3) {
            idb.createObjectStore("metadata", { keyPath: "user_id" });
          }
        }
      };
    } else {
      resolve(null);
    }
  });

const getIndexedDb = async () => {
  const idbHandler = await openIndexedDb();
  const idb = $state<IndexedDBResult | null>(idbHandler);
  return idb
    ? {
        get db() {
          return idb.idb;
        },
        get delete() {
          return idb.idbDelete;
        },
        get get() {
          return idb.idbGet;
        },
        get getAll() {
          return idb.idbGetAll;
        },
        get put() {
          return idb.idbPut;
        },
        get commitMutation() {
          return idb.idbCommitMutation;
        },
      }
    : null;
};

export const idb = await getIndexedDb();
