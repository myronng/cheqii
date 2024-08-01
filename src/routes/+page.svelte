<svelte:head>
	<title>Cheqii</title>
</svelte:head>
<h1>A <span>collaborative</span> payment splitting calculator</h1>

<style>
	@font-palette-values --title {
		font-family: 'Cairo Play';
		override-colors: 0 rgb(82 148 113);
	}

	h1 {
		font-family: 'Cairo Play';
		font-palette: --title;
		font-size: 3rem;

		span {
			color: var(--color-primary);
			text-decoration: underline var(--color-secondary);
		}
	}
</style>
