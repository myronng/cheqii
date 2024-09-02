<script lang="ts">
	import Button from '$lib/components/common/button.svelte';
	import Background from '$lib/components/index/background.svelte';
	import OnlineBanking from '$lib/components/index/onlineBanking.svelte';
</script>

<svelte:head>
	<title>Cheqii</title>
</svelte:head>

<Background />
<section>
	<article>
		<h1>A <span>collaborative</span> cheque splitter</h1>
		<p>Intelligently split your group purchases using fewer transactions.</p>
		<Button href="/c/1">Get Started</Button>
	</article>
	<OnlineBanking />
</section>

<style>
	@container (max-width: 900px) {
		section {
			flex-direction: column;
		}
	}
	section {
		align-items: center;
		display: flex;
		flex: 1;
		gap: calc(var(--length-spacing) * 4);
		justify-content: space-around;
		padding: calc(var(--length-spacing) * 4);
		position: relative;

		article {
			align-items: flex-start;
			background-color: var(--color-background-surface);
			backdrop-filter: blur(var(--length-surface-blur));
			border: var(--length-divider) solid var(--color-divider);
			border-radius: var(--length-radius);
			display: flex;
			flex-direction: column;
			gap: calc(var(--length-spacing) * 2);
			padding: calc(var(--length-spacing) * 4);
		}

		h1 {
			display: inline-block;
			font-family: 'Comfortaa';
			font-size: 2.5em;

			span {
				color: var(--color-primary);
			}
		}

		p {
			font-size: 1.5em;
			line-height: 1.5;
		}
	}
</style>
