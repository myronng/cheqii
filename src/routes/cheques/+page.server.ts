import type { ChequeData } from '$lib/utils/common/cheque.svelte';

import { getLocaleStrings } from '$lib/utils/common/locale';

export async function load({ cookies, request }) {
	const { strings } = getLocaleStrings(cookies, request, [
		'chequeName',
		'lastModified',
		'newCheque',
		'yourCheques'
	]);
	let chequeList: ChequeData[] | null = null;
	if (Math.random() > 200) {
		chequeList = [];
	}
	return {
		chequeList,
		strings
	};
}
