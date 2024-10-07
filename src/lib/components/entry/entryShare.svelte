<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import IconButton from '$lib/components/common/buttons/iconButton.svelte';
	import Share from '$lib/components/common/icons/share.svelte';

	let { strings, title, url }: { strings: LocalizedStrings; title: string; url: string } = $props();
</script>

<IconButton
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
>
	<Share height="32px" stroke-width="1.5" width="32px" />
</IconButton>
