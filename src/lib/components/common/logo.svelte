<a href="/">
	<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
		<circle cx="56" cy="128" r="26" />
		<line stroke-linecap="round" stroke-width="40" x1="88" x2="200" y1="180" y2="80" />
	</svg>
	<h1>Cheqii</h1>
</a>

<style>
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

			line {
				stroke: var(--color-primary);
			}
		}

		circle {
			fill: var(--color-primary);
			transition: ease fill 0.15s;
		}

		h1 {
			color: var(--color-primary);
			font-family: 'Comfortaa';
			font-size: 2rem;
			line-height: 1.25;
			margin: 0;
			transition: ease color 0.15s;
		}

		line {
			stroke: var(--color-secondary);
			transition: ease stroke 0.15s;
		}

		svg {
			height: 48px;
			width: 48px;
		}
	}
</style>
