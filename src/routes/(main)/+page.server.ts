import { getLocaleStrings } from '$lib/utils/common/locale';

export function load({ cookies, request }) {
	const { strings } = getLocaleStrings(cookies, request, [
		'a{collaborative}ChequeSplitter',
		'cheque{date}',
		'collaborative',
		'contributor{index}',
		'home',
		'intelligentlySplitYourGroupPurchasesUsingFewerTransactions',
		'item{index}',
		'newCheque',
		'getStarted',
		'yourCheques'
	]);
	return {
		strings
	};
}
