export type AccessType = 'editor' | 'owner' | 'viewer';

export type ChequeData = {
	access: {
		invite: {
			id: string;
			required: boolean;
			type: AccessType;
		};
		users: Record<string, User>;
	};
	contributors: Contributor[];
	editor: string[];
	items: Item[];
	owner: string[];
	title: string;
	updatedAt: number;
	viewer: string[];
};

export type Contributor = {
	id: string;
	name: string;
};

export type Item = {
	buyer: number;
	cost: number;
	name: string;
	split: number[];
};

export type User = {
	email: string;
	name: string;
	payment: {
		id: string;
		type: string;
	};
};
