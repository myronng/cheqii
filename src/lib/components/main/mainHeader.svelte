<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import Button from '$lib/components/common/buttons/button.svelte';
	import ButtonLink from '$lib/components/common/buttons/buttonLink.svelte';
	import Add from '$lib/components/common/icons/add.svelte';
	import Grid from '$lib/components/common/icons/grid.svelte';
	import Logo from '$lib/components/common/logo.svelte';

	let { strings }: { strings: LocalizedStrings } = $props();
</script>

<svelte:head>
	<title>Cheqii</title>
</svelte:head>

<header>
	<Logo {strings} />
	<div class="actions">
		<Button borderless>
			<Grid />
			{strings['yourCheques']}
		</Button>
		<ButtonLink borderless href="/c">
			<Add />
			{strings['newCheque']}
		</ButtonLink>
	</div>
</header>

<style>
	header {
		display: flex;
		gap: var(--length-spacing);
		justify-content: space-between;
		padding: var(--length-spacing);
	}

	.actions {
		display: flex;
		gap: var(--length-spacing);
	}
</style>
