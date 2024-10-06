import type { ChequeData } from '$lib/utils/common/cheque.svelte';

import {
	getLocaleStrings,
	interpolateString,
	type LocalizedStrings
} from '$lib/utils/common/locale';
import { redirect } from '@sveltejs/kit';

import { MOCK_CHEQUE_DATA_COMPLEX } from '../../../../tests/mockData';

const USE_MOCK_DATA = false;

export async function load({ cookies, params, parent, request, url }) {
	const userId = (await parent()).userId;
	const inviteId = cookies.get(params.id);
	const { strings } = getLocaleStrings(cookies, request, [
		'addContributor',
		'addItem',
		'anonymous',
		'anyoneOnTheInternetCanAccessThisCheque',
		'balance',
		'balanceCalculation{subtrahend}{minuend}',
		'buyer',
		'cheque',
		'cheque{date}',
		'chequeName',
		'close',
		'contributor{index}',
		'cost',
		'deleteCheque',
		'downloadCsv',
		'invited',
		'etransfer',
		'exportChequeDataToUseInOtherApplications',
		'home',
		'inviteLink',
		'item',
		'{item}Buyer',
		'{item}ContributionFrom{contributor}',
		'{item}Cost',
		'item{index}',
		'leaveCheque',
		'linkedTo{contributor}',
		'linkPaymentAccountTo{payee}',
		'{user}HasNoPaymentAccountSetUp',
		'notLinked',
		'onlyInvitedUsersCanAccessThisCheque',
		'owing',
		'owingCalculation{multiplicand}{numerator}{denominator}',
		'owner',
		'paid',
		'{payer}Sends{payee}{value}',
		'paymentId',
		'paymentMethod',
		'private',
		'public',
		'regenerateInviteLink',
		'remove{item}',
		'settings',
		'share',
		'subtotal',
		'theCurrentInvitationLinkWillNoLongerWork',
		'thisWillDeleteTheChequeForAllUsers',
		'total',
		'{user}(you)',
		'users',
		'{value}UnaccountedFor',
		'youWillNotBeAbleToAccessThisChequeAnymore'
	]);
	const cheque = getCheque(strings, userId);
	if (cheque) {
		// If private + not invited, redirect to home
		if (
			!cheque.access.invite.required &&
			inviteId !== cheque.access.invite.id &&
			userId &&
			!cheque.access.users[userId]
		) {
			redirect(307, '/');
		}
	}
	if (inviteId) {
		cookies.delete(params.id, { path: '/' });
	}
	return {
		cheque,
		invited: cheque && inviteId === cheque.access.invite.id,
		origin: url.origin,
		pathname: params.id,
		strings
	};
}

const getCheque = (strings: LocalizedStrings, userId: string): ChequeData => {
	if (USE_MOCK_DATA) {
		return MOCK_CHEQUE_DATA_COMPLEX;
	}
	return {
		access: {
			invite: {
				id: crypto.randomUUID(),
				required: true
			},
			users: {
				[userId]: {
					authority: 'owner'
				}
			}
		},
		contributors: [
			{
				id: userId,
				name: interpolateString(strings['contributor{index}'], { index: '1' })
			},
			{
				id: crypto.randomUUID(),
				name: interpolateString(strings['contributor{index}'], { index: '2' })
			}
		],
		id: crypto.randomUUID(),
		items: [
			{
				buyer: 0,
				cost: 1000,
				name: interpolateString(strings['item{index}'], { index: '1' }),
				split: [1, 1]
			},
			{
				buyer: 1,
				cost: 3000,
				name: interpolateString(strings['item{index}'], { index: '2' }),
				split: [1, 2]
			}
		],
		name: interpolateString(strings['cheque{date}'], {
			date: new Date().toISOString().split('T')[0]
		}),
		updatedAt: Date.now()
	};
};
