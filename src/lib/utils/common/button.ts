import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

export function isAnchorProps(
	props: HTMLAnchorAttributes | HTMLButtonAttributes
): props is HTMLAnchorAttributes {
	return 'href' in props ? true : false;
}
export function isButtonProps(
	props: HTMLAnchorAttributes | HTMLButtonAttributes
): props is HTMLButtonAttributes {
	return 'href' in props ? false : true;
}
