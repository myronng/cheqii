import { goto } from '$app/navigation';
import { DATE_FORMATTER } from '$lib/utils/common/formatter';
import { idb } from '$lib/utils/common/indexedDb.svelte';
import { interpolateString, type LocalizedStrings } from '$lib/utils/common/locale';
import { getUser, type Metadata, type User } from '$lib/utils/common/user.svelte';

export type AccessType = 'invited' | 'owner' | 'public';

export type ChequeUserAccess = { authority: AccessType } & Pick<User, 'email' | 'name' | 'payment'>;

export type ChequeData = {
	access: {
		invite: ChequeInvite;
		users: Record<User['id'], ChequeUserAccess>;
	};
	contributors: Contributor[];
	id: string;
	items: Item[];
	name: string;
} & Metadata;

export type ChequeInvite = {
	id: string;
	required: boolean;
};

export type Contributor = {
	id: User['id'];
	name: string;
};

export type Item = {
	buyer: number;
	cost: number;
	name: string;
	split: number[];
};

export type OnChequeChange = (chequeData: ChequeData) => Promise<void>;

export const INVITE_ACCESS = new Set(['invited', 'owner']);

export const initializeCheque = (strings: LocalizedStrings, user: User): ChequeData => {
	const userAccess: ChequeUserAccess = {
		authority: 'owner'
	};
	if (user.email) {
		userAccess.email = user.email;
	}
	if (user.name) {
		userAccess.name = user.name;
	}
	if (user.payment) {
		userAccess.payment = user.payment;
	}
	return {
		access: {
			invite: {
				id: crypto.randomUUID(),
				required: true
			},
			users: {
				[user.id]: userAccess
			}
		},
		contributors: [
			{
				id: user.id,
				name: interpolateString(strings['contributor{index}'], { index: '1' })
			},
			{
				id: crypto.randomUUID(),
				name: interpolateString(strings['contributor{index}'], { index: '2' })
			}
		],
		id: crypto.randomUUID(),
		items: [
			{
				buyer: 0,
				cost: 3000,
				name: interpolateString(strings['item{index}'], { index: '1' }),
				split: [1, 2]
			},
			{
				buyer: 1,
				cost: 1000,
				name: interpolateString(strings['item{index}'], { index: '2' }),
				split: [1, 1]
			}
		],
		name: interpolateString(strings['cheque{date}'], {
			date: DATE_FORMATTER.format(new Date())
		}),
		updatedAtClient: Date.now()
	};
};

export const createChequeClient = async (strings: LocalizedStrings, userId: User['id']) => {
	const { get: user, set: setUser } = await getUser(userId);
	if (user) {
		try {
			const response = await fetch('/cheques', {
				body: JSON.stringify({ user }),
				headers: { 'Content-Type': 'application/json' },
				method: 'POST'
			});
			if (response.ok) {
				const chequeData = await response.json();
				await Promise.all([
					setUser({ cheques: user.cheques.concat(chequeData.id) }),
					idb?.put('cheques', chequeData)
				]);
				goto(`/cheques/${chequeData.id}`);
			}
		} catch (err) {
			console.log(err);
			const chequeData = initializeCheque(strings, user);
			await Promise.all([
				setUser({ cheques: user.cheques.concat(chequeData.id) }),
				idb?.put('cheques', chequeData)
			]);
			goto(`/cheques/${chequeData.id}`);
		}
	}
};
