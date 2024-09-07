<script lang="ts">
	import Logo from '$lib/components/common/logo.svelte';
	import IconButton from '$lib/components/common/buttons/iconButton.svelte';
	import ChequeTitle from '$lib/components/cheque/chequeTitle.svelte';
	import Share from '$src/lib/components/common/icons/share.svelte';
	import Settings from '$src/lib/components/common/icons/settings.svelte';

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
		<IconButton>
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
