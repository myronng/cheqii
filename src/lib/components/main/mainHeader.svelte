<script lang="ts">
	import Logo from '$lib/components/base/logo.svelte';
	import AccountButton from '$lib/components/common/accountButton.svelte';
	import MainNewChequeButton from '$lib/components/main/mainNewChequeButton.svelte';
	import type { LocalizedStrings } from '$lib/utils/common/locale';
	import type { CheqiiUser } from '$lib/utils/common/user.svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';

	let {
		strings,
		supabase,
		userId
	}: { strings: LocalizedStrings; supabase: SupabaseClient; userId: CheqiiUser['id'] } = $props();
</script>

<svelte:head>
	<title>Cheqii</title>
</svelte:head>

<header>
	<Logo {strings} />
	<div class="actions">
		<MainNewChequeButton {strings} {userId} />
		<AccountButton {strings} {supabase} />
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
