const DB_NAME = 'cheqii';
const DB_VERSION = 1;

export const openIndexedDb = (dbVersion = DB_VERSION, dbName = DB_NAME) =>
	new Promise<{
		idb: IDBDatabase;
		idbDelete: (storeName: string, key: IDBKeyRange | IDBValidKey) => Promise<IDBRequest['result']>;
		idbGet: <T>(
			storeName: string,
			key: IDBKeyRange | IDBValidKey
		) => Promise<IDBRequest<T>['result']>;
		// Any JS primitive/non-primitive can be stored in IDB
		idbPut: (storeName: string, value: unknown, key?: IDBValidKey) => Promise<IDBRequest['result']>;
	}>((resolve, reject) => {
		const request = indexedDB.open(dbName, dbVersion);

		request.onerror = (e) => {
			const error = (e.currentTarget as IDBOpenDBRequest).error;
			reject(new Error(error?.message, { cause: error }));
		};

		request.onsuccess = (e) => {
			const idb = (e.currentTarget as IDBOpenDBRequest).result;

			idb.onversionchange = (eVersionChange) => {
				const idbVersionChange = e.currentTarget as IDBDatabase;
				idbVersionChange.close();

				if (typeof eVersionChange.newVersion === 'number') {
					openIndexedDb(eVersionChange.newVersion);
				}
			};

			resolve({
				idb,
				idbDelete: (storeName, key) =>
					new Promise((resolveDelete, rejectDelete) => {
						const transaction = idb.transaction(storeName, 'readwrite');
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
						const transaction = idb.transaction(storeName, 'readonly');
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
				idbPut: (storeName, value, key) =>
					new Promise((resolvePut, rejectPut) => {
						const transaction = idb.transaction(storeName, 'readwrite');
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
					})
			});
		};

		request.onupgradeneeded = (e) => {
			const idb = (e.currentTarget as IDBOpenDBRequest).result;
			switch (e.newVersion) {
				case 1: {
					idb.createObjectStore('cheques');
					break;
				}
				// case 2: {
				// 	if (e.oldVersion < 1) {
				// 		idb.createObjectStore('cheques');
				// 	}
				// 	idb.createObjectStore('preferences', { keyPath: 'userId' });
				// 	break;
				// }
			}
		};
	});
