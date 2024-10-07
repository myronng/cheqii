import { redirect } from '@sveltejs/kit';

export function load({ cookies, params }) {
	cookies.set(params.chequeId, params.inviteId, {
		path: '/'
	});

	redirect(307, `/cheques/${params.chequeId}`);
}
