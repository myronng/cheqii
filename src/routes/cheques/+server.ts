import { initializeCheque } from '$lib/utils/common/cheque.svelte';
import { getLocaleStrings } from '$lib/utils/common/locale';
import { json } from '@sveltejs/kit';

export async function POST({ cookies, request }) {
	const { user } = await request.json();
	const { strings } = getLocaleStrings(cookies, request, [
		'cheque{date}',
		'contributor{index}',
		'item{index}'
	]);
	const cheque = initializeCheque(strings, user);
	cheque.updatedAtServer = cheque.updatedAtClient;
	return json(cheque);
}
