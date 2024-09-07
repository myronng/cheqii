// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export type AccessType = 'owner' | 'editor' | 'viewer';

export type ChequeData = {
	contributors: Contributor[];
	editor: string[];
	access: {
		invite: {
			id: string;
			required: boolean;
			type: AccessType;
		};
		users: Record<string, User>;
	};
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
