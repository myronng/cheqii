import { getLocaleStrings } from '$lib/utils/common/locale';

export function load({ cookies, request }) {
	const { strings } = getLocaleStrings(cookies, request, [
		'a{collaborative}ChequeSplitter',
		'collaborative',
		'home',
		'intelligentlySplitYourGroupPurchasesUsingFewerTransactions',
		'getStarted'
	]);
	return {
		strings
	};
}
