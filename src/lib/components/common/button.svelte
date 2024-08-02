<script lang="ts">
	let { children } = $props<{}>();
</script>

<button>
	{@render children()}
</button>

<style>
	button {
		background-color: var(--color-primary);
		border: var(--length-divider) solid var(--color-divider);
		border-radius: var(--length-radius);
		cursor: pointer;
		display: flex;
		justify-content: center;
		padding: calc(var(--length-spacing) * 2) calc(var(--length-spacing) * 4);
		transition: ease background-color 0.15s;

		&:active {
			background-color: var(--color-secondary);
		}
	}
</style>
