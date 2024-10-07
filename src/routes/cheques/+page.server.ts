import type { ChequeData } from '$lib/utils/common/cheque.svelte';

import { getLocaleStrings } from '$lib/utils/common/locale';

export async function load({ cookies, request }) {
	const { strings } = getLocaleStrings(cookies, request, ['newCheque', 'yourCheques']);
	let chequeList: ChequeData[] | undefined;
	if (Math.random() > 200) {
		chequeList = [];
	}
	return {
		chequeList,
		strings
	};
}
