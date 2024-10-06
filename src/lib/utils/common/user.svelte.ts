import type { ChequeData, ChequeInvite } from '$lib/utils/common/cheque.svelte';
import type { PAYMENT_METHODS } from '$lib/utils/common/payments';

import { idb } from '$lib/utils/common/indexedDb.svelte';

export type OnUserChange = (userData: Partial<User>) => Promise<void>;

export type User = {
	cheques: ChequeData['id'][];
	email?: string;
	id: string;
	invite: Pick<ChequeInvite, 'required'>;
	name?: string;
	payment?: {
		id: string;
		method: (typeof PAYMENT_METHODS)[number];
	};
	updatedAt: number;
};

let userData = $state<null | User>(null);

export const getUser = async (userId: User['id']) => {
	const user = await idb?.get<User>('users', userId);
	if (!user) {
		userData = {
			cheques: [],
			id: userId,
			invite: {
				required: false
			},
			updatedAt: Date.now()
		};
		await idb?.put('users', JSON.parse(JSON.stringify(userData)));
	} else {
		userData = user;
	}

	async function set(newUserData: Partial<User>) {
		userData = {
			...(userData ?? {
				cheques: [],
				id: userId,
				invite: {
					required: false
				},
				updatedAt: Date.now()
			}),
			...newUserData,
			updatedAt: Date.now()
		};
		await idb?.put('users', JSON.parse(JSON.stringify(userData)));
		return userData;
	}

	return {
		get get() {
			return userData;
		},
		set
	};
};
