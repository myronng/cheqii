<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		borderless = false,
		children,
		color,
		padding = 1,
		...props
	}: {
		borderless?: boolean;
		color?: 'default' | 'error';
		padding?: number;
	} & HTMLButtonAttributes = $props();

	const classes: string[] = [];
	if (borderless) {
		classes.push('borderless');
	}

	if (color === 'error') {
		classes.push('error');
	}
</script>

<button class={classes.join(' ')} style:--padding={padding} {...props}>
	{@render children?.()}
</button>

<style>
	button {
		align-items: center;
		background-color: transparent;
		border-radius: 100vw;
		color: var(--color-primary);
		display: flex;
		font: inherit;
		font-family: Comfortaa;
		font-weight: 700;
		gap: var(--length-spacing);
		justify-content: center;
		padding-block: calc(var(--length-spacing) * var(--padding));
		padding-inline: calc(var(--length-spacing) * 2 * var(--padding));
		text-decoration: none;

		@media (prefers-reduced-motion: no-preference) {
			transition:
				ease background-color 75ms,
				border-color 75ms;
		}

		&:disabled {
			border-color: var(--color-divider);
			color: var(--color-font-disabled);
			pointer-events: none;
		}

		&:not(:disabled) {
			border-color: var(--color-primary);
			cursor: pointer;

			&:active {
				background-color: var(--color-background-active);
			}

			&:hover:not(:active) {
				background-color: var(--color-background-hover);
			}

			&.error {
				color: var(--color-error);

				&:not(.borderless) {
					border-color: var(--color-error);
				}
			}
		}

		&:not(.borderless) {
			border-style: solid;
			border-width: var(--length-divider);
		}

		&.borderless {
			border: 0;
		}
	}
</style>
