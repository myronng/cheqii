<script lang="ts">
	import Logo from '$lib/components/common/logo.svelte';
	import Share from 'virtual:icons/hugeicons/share-08';
	import Settings from 'virtual:icons/hugeicons/settings-01';
	import IconButton from '$lib/components/common/buttons/iconButton.svelte';
	import ChequeTitle from '$lib/components/cheque/chequeTitle.svelte';

	const currentDate = new Date();
	let { data } = $props();
	let value = $state(`Cheque ${currentDate.toISOString().split('T')[0]}`);
</script>

<svelte:head>
	<title>{value}</title>
</svelte:head>

<header>
	<section>
		<Logo hasTitle={false} />
		<ChequeTitle />
	</section>
	<section>
		<IconButton>
			<Share height="1em" width="1em" />
		</IconButton>
		<IconButton href={`${data.url}/settings`}>
			<Settings height="1em" width="1em" />
		</IconButton>
	</section>
</header>
<section class="content"></section>

<style>
	header {
		display: flex;
		gap: var(--length-spacing);
		justify-content: space-between;
		padding: var(--length-spacing);

		section {
			display: flex;
			gap: var(--length-spacing);
		}
	}
</style>
