<script lang="ts">
	import type { User } from '$lib/types/user';

	import { idb } from '$lib/utils/common/indexedDb.svelte';

	import '../app.css';

	let { children, data } = $props();

	const initialize = async () => {
		const user = await idb?.get<User>('users', data.userId);
		if (!user) {
			const userData: User = {
				checks: [],
				id: data.userId,
				invite: {
					required: false,
					type: 'editor'
				},
				updatedAt: Date.now()
			};
			await idb?.put('users', userData);
		}
		return { idb };
	};
	initialize();
</script>

{@render children()}
