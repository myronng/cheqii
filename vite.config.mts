import { sveltekit } from '@sveltejs/kit/vite';

export default {
	build: {
		target: 'es2022'
	},
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
};
