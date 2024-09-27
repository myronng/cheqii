import type { User } from '$lib/types/user';

export type AccessType = 'editor' | 'owner' | 'viewer';

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
	title: string;
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
