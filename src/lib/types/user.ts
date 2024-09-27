import type { ChequeData, ChequeInvite } from '$lib/types/cheque';

export type User = {
	checks: ChequeData['id'][];
	email?: string;
	id: string;
	invite: Pick<ChequeInvite, 'required' | 'type'>;
	name?: string;
	payment?: {
		id: string;
		type: 'etransfer';
	};
};
