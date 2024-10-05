import type { ChequeData } from '$lib/types/cheque';

import { getLocaleStrings } from '$lib/utils/common/locale';

export function load({ cookies, params, request }) {
	const { strings } = getLocaleStrings(cookies, request, [
		'addContributor',
		'addItem',
		'anyoneOnTheInternetCanAccessThisCheque',
		'balance',
		'balanceCalculation{subtrahend}{minuend}',
		'buyer',
		'cheque{date}',
		'chequeName',
		'chequeTotal',
		'close',
		'contributor{index}',
		'cost',
		'etransfer',
		'home',
		'item',
		'{item}Buyer',
		'{item}ContributionFrom{contributor}',
		'{item}Cost',
		'item{index}',
		'linkPaymentAccountTo{payee}',
		'noPaymentAccountLinkedTo{payee}',
		'onlyInvitedUsersCanAccessThisCheque',
		'owing',
		'owingCalculation{multiplicand}{numerator}{denominator}',
		'paid',
		'{payer}Sends{payee}{value}',
		'paymentId',
		'paymentMethod',
		'private',
		'public',
		'remove{item}',
		'settings',
		'share',
		'subtotal',
		'{value}UnaccountedFor'
	]);
	const cheque: ChequeData = {
		access: {
			invite: {
				id: '',
				required: false,
				type: 'editor'
			},
			users: {
				'5ce8a4e8-029a-49d9-a121-bb3f97b54b70': {
					authority: 'owner',
					email: 'am@email.ca',
					name: 'Austin',
					payment: { id: '', method: 'etransfer' }
				},
				'314f1654-9d4f-4d78-bd58-c568de938122': {
					authority: 'owner'
				},
				'f45081b6-a631-4b83-8098-81ebce287915': {
					authority: 'owner',
					email: 'mn@email.ca',
					name: 'Myron',
					payment: { id: 'mn@email.ca', method: 'etransfer' }
				},
				jg: {
					authority: 'editor',
					email: 'jg@email.ca',
					name: 'Jacob',
					payment: { id: '', method: 'etransfer' }
				}
			}
		},
		contributors: [
			{ id: 'f45081b6-a631-4b83-8098-81ebce287915', name: 'Myron' },
			{ id: 'sz', name: 'Shanna' },
			{ id: 'jg', name: 'Jacob' },
			{ id: 'am', name: 'Austin' }
		],
		id: params.id,
		items: [
			{
				buyer: 0,
				cost: 600,
				name: 'Test item 1',
				split: [1, 1, 1, 2]
			},
			{
				buyer: 1,
				cost: 362,
				name: 'Test item 2',
				split: [1, 1, 0, 1]
			},
			{
				buyer: 0,
				cost: 403,
				name: 'Test item 3',
				split: [1, 1, 1, 1]
			},
			{
				buyer: 1,
				cost: 303,
				name: 'Test item 4',
				split: [1, 1, 0, 1]
			},
			{
				buyer: 1,
				cost: 403,
				name: 'Test item 5',
				split: [0, 2, 1, 1]
			},
			{
				buyer: 0,
				cost: 403,
				name: 'Test item 6',
				split: [2, 0, 1, 1]
			}
		],
		name: 'Test cheque',
		updatedAt: Date.now()
	};
	return {
		cheque,
		strings
	};
}
