import type { ChequeData, ChequeInvite } from '$lib/types/cheque';
import type { PAYMENT_TYPES } from '$lib/utils/common/payments';

export type OnUserChange = (userData: Partial<User>) => void;

export type User = {
	checks: ChequeData['id'][];
	email?: string;
	id: string;
	invite: Pick<ChequeInvite, 'required' | 'type'>;
	name?: string;
	payment?: {
		id: string;
		type: (typeof PAYMENT_TYPES)[number];
	};
	updatedAt: number;
};
