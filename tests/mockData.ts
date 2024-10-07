import type { ChequeData } from '$lib/utils/common/cheque.svelte';

export const MOCK_CHEQUE_DATA_COMPLEX: ChequeData = {
	access: {
		invite: {
			id: 'dd77b021-d918-4fe6-9136-c6f373dcb833',
			required: true
		},
		users: {
			'5ce8a4e8-029a-49d9-a121-bb3f97b54b70': {
				authority: 'public',
				email: 'ev@email.ca',
				name: 'Eve',
				payment: { id: '', method: 'etransfer' }
			},
			'9e3cec0d-3db7-4973-b05d-1c0038d1a70d': {
				authority: 'invited'
			},
			'314f1654-9d4f-4d78-bd58-c568de938122': {
				authority: 'owner',
				email: 'da@email.ca',
				name: 'Dave',
				payment: { id: '', method: 'etransfer' }
			},
			'f45081b6-a631-4b83-8098-81ebce287915': {
				authority: 'public',
				email: 'mn@email.ca',
				name: 'Alice',
				payment: { id: 'al@email.ca', method: 'etransfer' }
			}
		}
	},
	contributors: [
		{ id: 'f45081b6-a631-4b83-8098-81ebce287915', name: 'Alice' },
		{ id: '0a22ebec-daea-4b99-b6bf-0e5063a5dc14', name: 'Bob' },
		{ id: '89d40d47-b298-4402-9a2a-f67ac6ad6795', name: 'Cleo' },
		{ id: '314f1654-9d4f-4d78-bd58-c568de938122', name: 'Dave' }
	],
	id: '0c5eda25-6808-472a-83a5-18ec58f56d70',
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
	name: 'Test cheque complex',
	updatedAtClient: 1728151030389
};

export const MOCK_CHEQUE_DATA_SIMPLE: ChequeData = {
	access: {
		invite: {
			id: 'dd77b021-d918-4fe6-9136-c6f373dcb833',
			required: false
		},
		users: {
			'314f1654-9d4f-4d78-bd58-c568de938122': {
				authority: 'invited',
				email: 'bo@email.ca',
				name: 'Bob Doe',
				payment: { id: 'boEtransfer@email.ca', method: 'etransfer' }
			},
			'f45081b6-a631-4b83-8098-81ebce287915': {
				authority: 'owner',
				email: 'al@email.ca',
				name: 'Alice Doe',
				payment: { id: 'alEtransfer@email.ca', method: 'etransfer' }
			}
		}
	},
	contributors: [
		{ id: 'f45081b6-a631-4b83-8098-81ebce287915', name: 'Alice' },
		{ id: '314f1654-9d4f-4d78-bd58-c568de938122', name: 'Bob' }
	],
	id: '0c5eda25-6808-472a-83a5-18ec58f56d70',
	items: [
		{
			buyer: 0,
			cost: 201,
			name: 'Test item 1',
			split: [1, 1]
		},
		{
			buyer: 1,
			cost: 100,
			name: 'Test item 2',
			split: [1, 0]
		}
	],
	name: 'Test cheque simple',
	updatedAtClient: 1728151030389
};
