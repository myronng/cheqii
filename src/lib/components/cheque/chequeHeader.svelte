<script lang="ts">
	import Logo from '$lib/components/common/logo.svelte';
	import Share from 'virtual:icons/hugeicons/share-08';
	import Settings from 'virtual:icons/hugeicons/settings-01';
	import IconButton from '$lib/components/common/buttons/iconButton.svelte';
	import ChequeTitle from '$lib/components/cheque/chequeTitle.svelte';

	let { title, url }: { title?: string; url: string } = $props();
</script>

<header>
	<section>
		<Logo hasTitle={false} />
		<ChequeTitle {title} />
	</section>
	<section>
		<IconButton>
			<Share height="32px" width="32px" />
		</IconButton>
		<IconButton href={`${url}/settings`}>
			<Settings height="32px" width="32px" />
		</IconButton>
	</section>
</header>

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
