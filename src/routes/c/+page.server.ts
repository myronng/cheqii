import { redirect } from '@sveltejs/kit';

export function load() {
	const id = crypto.randomUUID();
	redirect(307, `/c/${id}`);
}
