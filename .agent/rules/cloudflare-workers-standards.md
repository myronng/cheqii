---
trigger: always_on
---

# Cloudflare Workers & Edge Runtime Standards

## 1. Runtime Restrictions

- **No Node.js Built-ins**: Strictly forbid usage of `process`, `fs`, `path`, or `crypto` (Node version).
- **Web Standards Only**: Use `fetch`, `SubtleCrypto`, `TextEncoder`, and `ReadableStream`.
- **Bundle Size**: Minimize heavy third-party dependencies to keep Worker startup time (cold starts) under 50ms.

## 2. Environment & Bindings

- **Access Pattern**: Never use `process.env`. Access all environment variables, secrets, and KV/D1 bindings via the `platform` object provided by SvelteKit's `RequestEvent`.
- **Example**: `const { SUPABASE_KEY } = event.platform.env;`
- **Type Safety**: Ensure all bindings are explicitly typed in `src/app.d.ts` under the `Platform` interface.

## 3. Supabase Server-Side Initialization

- **Scoped Fetch**: When initializing the Supabase client inside `hooks.server.ts` or `+server.ts`, you MUST pass the native `fetch` from the event context.
- **Reasoning**: This ensures the client uses the Cloudflare-optimized fetch implementation rather than a generic polyfill.
  ```typescript
  const supabase = createClient(URL, KEY, { global: { fetch } });
  ```

## 4. Edge Geography

- Be mindful of the "Edge" location. Do not perform heavy computations in load functions that could be handled on the client, as this increases latency for users far from the nearest POP (Point of Presence).
