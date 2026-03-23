# cheqii

Everything you need to build a Svelte project, now powered by [Vite+](https://viteplus.dev).

## Developing

To start a development server:

```bash
vp dev
```

## Building

To create a production version of your app:

```bash
vp build
```

> [!NOTE]
> In CI/CD environments (like Cloudflare Pages), use `pnpm run build` instead of `vp build` if `vp` is not available as a global binary.

You can preview the production build with `vp preview`.

## Deploying

To deploy to Cloudflare:

```bash
vp run deploy:remote
```
