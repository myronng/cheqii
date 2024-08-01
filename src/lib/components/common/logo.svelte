<a href="/">
	<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
		<circle cx="56" cy="128" r="26" />
		<line stroke-linecap="round" stroke-width="40" x1="88" x2="200" y1="180" y2="80" />
	</svg>
	<h1>Cheqii</h1>
</a>

<style>
	@font-palette-values --logo {
		font-family: 'Cairo Play';
		override-colors: 0 rgb(131 204 97);
	}

	@font-palette-values --logo-active {
		font-family: 'Cairo Play';
		override-colors: 0 rgb(82 148 113);
	}

	a {
		align-items: center;
		display: flex;
		gap: var(--length-spacing);
		margin-right: auto;
		text-decoration: none;

		&:active {
			circle {
				fill: var(--color-secondary);
			}

			h1 {
				color: var(--color-primary);
				font-palette: --logo-active;
			}

			line {
				stroke: var(--color-primary);
			}
		}
	}

	circle {
		fill: var(--color-primary);
		transition: ease fill 0.15s;
	}

	h1 {
		color: var(--color-secondary);
		font-family: 'Cairo Play';
		font-palette: --logo;
		font-size: 2rem;
		line-height: 1.25;
		margin: 0;
		transition:
			ease color 0.15s,
			ease font-palette 0.15s;
	}

	line {
		stroke: var(--color-secondary);
		transition: ease stroke 0.15s;
	}

	svg {
		height: 48px;
		width: 48px;
	}
</style>
