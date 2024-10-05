import type { User } from '$lib/utils/common/user.svelte';

export type AccessType = 'editor' | 'owner';

export type ChequeInvite = {
	id: string;
	required: boolean;
	type: AccessType;
};

export type ChequeData = {
	access: {
		invite: ChequeInvite;
		users: Record<User['id'], { authority: AccessType } & Pick<User, 'email' | 'name' | 'payment'>>;
	};
	contributors: Contributor[];
	id: string;
	items: Item[];
	name: string;
	updatedAt: number;
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
