import type { ChequeData, ChequeInvite } from '$lib/types/cheque';
import type { PAYMENT_METHODS } from '$lib/utils/common/payments';

export type OnUserChange = (userData: Partial<User>) => void;

export type User = {
	checks: ChequeData['id'][];
	email?: string;
	id: string;
	invite: Pick<ChequeInvite, 'required' | 'type'>;
	name?: string;
	payment?: {
		id: string;
		method: (typeof PAYMENT_METHODS)[number];
	};
	updatedAt: number;
};
