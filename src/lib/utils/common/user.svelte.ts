import type { User } from '$lib/types/user';

import { idb } from '$lib/utils/common/indexedDb.svelte';

let userData = $state<null | User>(null);

export const getUser = async (userId: User['id']) => {
	const user = await idb?.get<User>('users', userId);
	if (!user) {
		userData = {
			checks: [],
			id: userId,
			invite: {
				required: false,
				type: 'editor'
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
				checks: [],
				id: userId,
				invite: {
					required: false,
					type: 'editor'
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
