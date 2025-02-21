import type { RequestHandler } from './$types';

import { initializeCheque } from '$lib/utils/common/cheque.svelte';
import { getLocaleStrings } from '$lib/utils/common/locale';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies, request }) => {
	const { user } = await request.json();
	const { strings } = getLocaleStrings(cookies, request, [
		'cheque{date}',
		'contributor{index}',
		'item{index}'
	]);
	const cheque = initializeCheque(strings, user);
	cheque.updatedAtServer = cheque.updatedAtClient;
	// const kv = await Deno.openKv();
	// await kv.set(['cheques', cheque.id], cheque);
	return json(cheque);
};
