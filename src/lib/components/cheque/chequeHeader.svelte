<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import ChequeTitle from '$lib/components/cheque/chequeTitle.svelte';
	import IconButton from '$lib/components/common/buttons/iconButton.svelte';
	import Settings from '$lib/components/common/icons/settings.svelte';
	import Share from '$lib/components/common/icons/share.svelte';
	import Logo from '$lib/components/common/logo.svelte';
	import { interpolateString } from '$lib/utils/common/locale';

	let { strings, title }: { strings: LocalizedStrings; title?: string } = $props();

	if (!title) {
		const currentDate = new Date();
		title = interpolateString(strings['cheque{date}'], {
			date: currentDate.toISOString().split('T')[0]
		});
	}
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
