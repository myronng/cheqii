import type { ChequeData } from '$src/app';

export function load({ url }) {
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
				split: {
					contributors: [1, 1, 1, 2],
					total: 5
				}
			},
			{
				buyer: 1,
				cost: 362,
				name: 'Test item 2',
				split: {
					contributors: [1, 1, 0, 1],
					total: 3
				}
			},
			{
				buyer: 0,
				cost: 403,
				name: 'Test item 3',
				split: {
					contributors: [1, 1, 1, 1],
					total: 4
				}
			},
			{
				buyer: 1,
				cost: 303,
				name: 'Test item 4',
				split: {
					contributors: [1, 1, 0, 1],
					total: 3
				}
			},
			{
				buyer: 1,
				cost: 403,
				name: 'Test item 5',
				split: {
					contributors: [0, 2, 1, 1],
					total: 4
				}
			},
			{
				buyer: 0,
				cost: 403,
				name: 'Test item 6',
				split: {
					contributors: [2, 0, 1, 1],
					total: 4
				}
			}
		],
		owner: ['mn'],
		title: 'Test Trip',
		updatedAt: Date.now(),
		viewer: ['jg']
	};
	return {
		cheque,
		url: url.pathname
	};
}
