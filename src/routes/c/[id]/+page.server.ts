import { getLocaleStrings } from '$lib/utils/common/locale';
import { redirect } from '@sveltejs/kit';

import { MOCK_CHEQUE_DATA_COMPLEX } from '../../../../tests/mockData';

export function load({ cookies, params, request, url }) {
	const userId = cookies.get('userId');
	const inviteId = cookies.get(params.id);
	// If private + not invited, redirect to home
	if (
		!MOCK_CHEQUE_DATA_COMPLEX.access.invite.required &&
		inviteId !== MOCK_CHEQUE_DATA_COMPLEX.access.invite.id &&
		userId &&
		!MOCK_CHEQUE_DATA_COMPLEX.access.users[userId]
	) {
		redirect(307, '/');
	}
	if (inviteId) {
		cookies.delete(params.id, { path: '/' });
	}
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
	return {
		cheque: MOCK_CHEQUE_DATA_COMPLEX,
		invited: inviteId === MOCK_CHEQUE_DATA_COMPLEX.access.invite.id,
		origin: url.origin,
		pathname: params.id,
		strings
	};
}
