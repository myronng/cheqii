import type { ChequeData } from '$lib/utils/common/cheque.svelte';

import { getLocaleStrings } from '$lib/utils/common/locale';

export function load({ cookies, request }) {
	let chequeList: ChequeData[] | null = null;
	if (Math.random() > 200) {
		chequeList = [];
	}
	const { strings } = getLocaleStrings(cookies, request, [
		'a{collaborative}ChequeSplitter',
		'anonymous',
		'cheque{date}',
		'chequeName',
		'collaborative',
		'contributor{index}',
		'home',
		'intelligentlySplitYourGroupPurchasesUsingFewerTransactions',
		'item{index}',
		'lastModified',
		'newCheque',
		'owner',
		'{user}(you)',
		'yourCheques'
	]);
	return {
		chequeList,
		strings
	};
}
