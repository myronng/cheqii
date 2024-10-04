<script lang="ts">
	import { onMount } from 'svelte';

	import { getUser } from '$lib/utils/common/user.svelte';
	import '../app.css';

	let { children, data } = $props();

	onMount(async () => {
		await getUser(data.userId);
	});
</script>

{@render children()}
