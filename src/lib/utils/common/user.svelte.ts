import type { ChequeData, ChequeInvite } from '$lib/utils/common/cheque.svelte';

export const PAYMENT_METHODS = ['etransfer'] as const;

import { idb } from '$lib/utils/common/indexedDb.svelte';

export type OnUserChange = (userData: Partial<User>) => Promise<void>;

export type Metadata = {
	serverSignature?: string;
	updatedAtClient: number;
	updatedAtServer?: number;
};

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
} & Metadata;

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
			updatedAtClient: Date.now()
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
				updatedAtClient: Date.now()
			}),
			...newUserData,
			updatedAtClient: Date.now()
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
