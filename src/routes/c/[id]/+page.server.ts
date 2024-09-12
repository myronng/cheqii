import type { ChequeData } from '$lib/types/cheque';

import { getLocaleStrings } from '$lib/utils/common/locale';

export function load({ cookies, request }) {
	const { strings } = getLocaleStrings(cookies, request, [
		'addContributor',
		'addItem',
		'balance',
		'buyer',
		'cheque{date}',
		'chequeTotal',
		'contributor{index}',
		'cost',
		'item',
		'item{index}',
		'linkPaymentAccountTo{payee}',
		'noPaymentAccountLinkedTo{payee}',
		'owing',
		'paid',
		'{payer}Sends{payee}{value}',
		'remove{item}',
		'{value}UnaccountedFor'
	]);
	const cheque: ChequeData = {
		access: {
			invite: {
				id: '',
				required: false,
				type: 'viewer'
			},
			users: {
				am: { email: 'am@email.ca', name: 'Austin', payment: { id: '', type: '' } },
				jg: { email: 'jg@email.ca', name: 'Jacob', payment: { id: '', type: '' } },
				mn: { email: 'mn@email.ca', name: 'Myron', payment: { id: '', type: '' } },
				sz: { email: 'sz@email.ca', name: 'Shanna', payment: { id: '', type: '' } }
			}
		},
		contributors: [
			{ id: 'mn', name: 'Myron' },
			{ id: 'sz', name: 'Shanna' },
			{ id: 'jg', name: 'Jacob' },
			{ id: 'am', name: 'Austin' }
		],
		editor: ['sz', 'am'],
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
		owner: ['mn'],
		title: 'Test Cheque',
		updatedAt: Date.now(),
		viewer: ['jg']
	};
	return {
		cheque,
		strings
	};
}
