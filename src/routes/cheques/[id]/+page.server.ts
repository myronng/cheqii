import type { ChequeData } from '$lib/utils/common/cheque.svelte';

import { getLocaleStrings } from '$lib/utils/common/locale';
import { redirect } from '@sveltejs/kit';

import { MOCK_CHEQUE_DATA_COMPLEX } from '../../../../tests/mockData';

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
	let cheque: ChequeData | undefined;
	// TODO: Get cheque from server if available
	if (Math.random() > 200) {
		cheque = MOCK_CHEQUE_DATA_COMPLEX;
	}
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
		chequeId: params.id,
		invited: cheque && inviteId === cheque.access.invite.id,
		origin: url.origin,
		strings
	};
}
