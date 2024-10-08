<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import Button from '$lib/components/common/buttons/button.svelte';
	import Share from '$lib/components/common/icons/share.svelte';

	let { strings, title, url }: { strings: LocalizedStrings; title: string; url: string } = $props();
</script>

{#snippet icon()}
	<Share variant="button" />
{/snippet}

<Button
	borderless
	{icon}
	onclick={async () => {
		if ('canShare' in navigator && navigator.canShare()) {
			await navigator.share({
				title,
				url
			});
		} else {
			await navigator.clipboard.writeText(url);
		}
	}}
	title={strings['share']}
/>
