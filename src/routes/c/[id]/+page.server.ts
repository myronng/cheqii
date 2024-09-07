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
				jg: { email: 'jg@email.ca', name: 'Jacob', payment: { id: '', type: '' } },
				mn: { email: 'mn@email.ca', name: 'Myron', payment: { id: '', type: '' } },
				sz: { email: 'sz@email.ca', name: 'Shanna', payment: { id: '', type: '' } }
			}
		},
		contributors: [
			{ id: 'mn', name: 'Myron' },
			{ id: 'sz', name: 'Shanna' },
			{ id: 'jg', name: 'Jacob' }
		],
		editor: ['sz'],
		items: [
			{
				buyer: 0,
				cost: 600,
				name: 'Test item 1',
				split: [1, 1, 1]
			},
			{
				buyer: 1,
				cost: 250,
				name: 'Test item 2',
				split: [1, 1, 0]
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
