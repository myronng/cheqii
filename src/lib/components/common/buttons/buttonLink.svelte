<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';

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
	} & HTMLAnchorAttributes = $props();

	const classes: string[] = [];
	if (borderless) {
		classes.push('borderless');
	}

	if (color === 'error') {
		classes.push('error');
	}
</script>

<a class={classes.join(' ')} style:--padding={padding} {...props}>
	{@render children?.()}
</a>

<style>
	a {
		align-items: center;
		background-color: transparent;
		border-radius: 100vw;
		color: var(--color-primary);
		cursor: pointer;
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

				&:not(.borderless) {
					border-color: var(--color-error);
				}
			}
		}

		&:not(.borderless) {
			border: var(--length-divider) solid var(--color-primary);
		}

		&.borderless {
			border: 0;
		}
	}
</style>
