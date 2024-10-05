<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		children,
		color,
		direction = 'row',
		padding = 1,
		...props
	}: {
		color?: 'default' | 'error';
		direction?: 'column' | 'row';
		padding?: number;
	} & HTMLButtonAttributes = $props();

	const classes: string[] = [];

	if (color === 'error') {
		classes.push('error');
	}
	if (direction === 'column') {
		classes.push('column');
	}
</script>

<button class={classes.join(' ')} style:--padding={padding} {...props}>
	{@render children?.()}
</button>

<style>
	button {
		background-color: transparent;
		border: 0;
		box-sizing: border-box;
		color: var(--color-primary);
		font: inherit;
		font-family: Comfortaa;
		font-weight: 700;
		gap: var(--length-spacing);
		block-size: auto;
		min-block-size: 0;
		overflow: hidden;
		padding-block: calc(var(--length-spacing) * var(--padding));
		padding-inline: calc(var(--length-spacing) * 2 * var(--padding));
		text-align: start;
		text-decoration: none;

		@media (prefers-reduced-motion: no-preference) {
			transition:
				ease block-size 75ms,
				padding-block 75ms,
				display 75ms allow-discrete,
				background-color 75ms;

			@starting-style {
				block-size: 0;
				padding-block: 0;
			}
		}

		&:disabled {
			color: var(--color-font-disabled);
			pointer-events: none;
		}

		&:not(:disabled) {
			cursor: pointer;

			&:active {
				background-color: var(--color-background-active);
			}

			&:hover:not(:active) {
				background-color: var(--color-background-hover);
			}

			&.error {
				color: var(--color-error);
			}
		}

		&:not([hidden]) {
			display: flex;
		}

		&[hidden] {
			block-size: 0;
			padding-block: 0;
		}

		&:not(.column) {
			align-items: center;
		}

		&.column {
			flex-direction: column;
			justify-content: center;
		}
	}
</style>
