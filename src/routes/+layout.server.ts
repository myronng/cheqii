export async function load({ cookies }) {
	const cookieUserId = cookies.get('userId');
	const userId = cookieUserId ?? crypto.randomUUID();
	if (!cookieUserId) {
		cookies.set('userId', userId, {
			path: '/'
		});
	}
	return {
		userId
	};
}
