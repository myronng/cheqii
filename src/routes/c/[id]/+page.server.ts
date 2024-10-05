import { getLocaleStrings } from '$lib/utils/common/locale';

import { MOCK_CHEQUE_DATA_COMPLEX } from '../../../../tests/mockData';

export function load({ cookies, request, url }) {
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
		'editor',
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
		origin: url.origin,
		pathname: url.pathname,
		strings
	};
}
