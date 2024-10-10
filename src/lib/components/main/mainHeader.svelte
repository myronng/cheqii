<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';
	import type { User } from '$lib/utils/common/user.svelte';

	import Logo from '$lib/components/common/logo.svelte';
	import MainNewChequeButton from '$lib/components/main/mainNewChequeButton.svelte';

	let { strings, userId }: { strings: LocalizedStrings; userId: User['id'] } = $props();
</script>

<svelte:head>
	<title>Cheqii</title>
</svelte:head>

<header>
	<Logo {strings} />
	<div class="actions">
		<MainNewChequeButton {strings} {userId} />
	</div>
</header>

<style>
	header {
		background-color: var(--color-background-primary);
		border-bottom: var(--length-divider) solid var(--color-divider);
		display: flex;
		gap: var(--length-spacing);
		justify-content: space-between;
		padding: var(--length-spacing);
		position: sticky;
		top: 0;
		z-index: 1000;
	}

	.actions {
		display: flex;
		gap: var(--length-spacing);
	}
</style>
