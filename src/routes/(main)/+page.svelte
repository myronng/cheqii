<script lang="ts">
	import Background from '$lib/components/main/background.svelte';
	import Button from '$lib/components/common/buttons/button.svelte';
	import HeroImage from '$lib/components/main/heroImage.svelte';
</script>

<Background />
<section>
	<article>
		<h1>A <span>collaborative</span> cheque splitter</h1>
		<p>Intelligently split your group purchases using fewer transactions.</p>
		<Button href="/c">Get Started</Button>
	</article>
	<HeroImage />
</section>

<style>
	@container (max-width: 768px) {
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
			font-size: 2.5rem;

			span {
				color: var(--color-primary);
			}
		}

		p {
			font-size: 1.5rem;
			line-height: 1.5;
		}
	}
</style>
