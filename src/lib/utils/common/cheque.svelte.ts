import type { User } from '$lib/utils/common/user.svelte';

export type AccessType = 'invited' | 'owner' | 'public';

export type ChequeAccess = { authority: AccessType } & Pick<User, 'email' | 'name' | 'payment'>;

export type ChequeData = {
	access: {
		invite: ChequeInvite;
		users: Record<User['id'], ChequeAccess>;
	};
	contributors: Contributor[];
	id: string;
	items: Item[];
	name: string;
	updatedAt: number;
};

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

export type OnChequeChange = () => Promise<void>;

export const INVITE_ACCESS = new Set(['invited', 'owner']);
