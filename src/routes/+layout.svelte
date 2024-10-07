<script lang="ts">
	import { getUser } from '$lib/utils/common/user.svelte';
	import { onMount } from 'svelte';

	import '../app.css';

	let { children, data } = $props();

	onMount(async () => {
		await getUser(data.userId);
	});
</script>

{@render children()}
