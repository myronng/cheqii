# Cheqii

Collaborative bill-splitting app. SvelteKit 5 + Supabase + Cloudflare Workers.

## Commands

```bash
pnpm run dev              # Dev server
pnpm run check            # svelte-kit sync + svelte-check (run before tests)
pnpm run test:unit        # Vitest unit tests
pnpm run test:integration # Playwright e2e tests
pnpm run test             # Both unit + integration
pnpm run lint             # Prettier + oxlint
pnpm run format           # Prettier --write
pnpm run build            # Production build
```

## Architecture

- **Offline-first**: IndexedDB is the UI source of truth. Supabase syncs via outbox pattern through `/api/sync`.
- **Edge runtime**: Cloudflare Workers — no Node.js APIs. Use Web Standards only.
- **Auth**: Google One-Tap + anonymous sign-in via Supabase Auth.
- **IDs**: Client-generated UUIDs (`crypto.randomUUID()`). No auto-increment.
- **Security**: RLS on all tables. Cloudflare Turnstile for bot protection.

## Module Ownership (for agent teams)

When working in a team, each agent should own distinct files to avoid conflicts:

| Domain | Directory | Notes |
|--------|-----------|-------|
| UI components | `src/lib/components/` | Svelte 5 runes, CSS variables only |
| State models | `src/lib/utils/models/` | bill.svelte.ts, sync.svelte.ts, user.svelte.ts |
| Shared utils | `src/lib/utils/common/` | locale, allocate, indexedDb |
| Routes & API | `src/routes/` | SvelteKit routes, `/api/sync` endpoint |
| Database | `supabase/migrations/` | Use `pnpx supabase db diff -f <name>` |
| Tests | Co-located `*.test.ts` | Use shared mocks from `testMocks.ts` |

## Conventions

- **pnpm only** — never npm or yarn
- **TypeScript strict** — no `any` types
- **CSS variables** — no hardcoded colors, use `--color-*` and `--length-*` from app.css
- **Dark mode** — all styles must support `[data-theme="dark"]`
- **Mutations** — write to IndexedDB first, queue in outbox, sync async
- **Database** — snake_case names, idempotent SQL, SECURITY INVOKER for RPCs

## Agent Decision Logging

When working autonomously (CI/CD or agent teams), follow this protocol:

### When you encounter a blocker:
1. **Do not stop.** Implement the best solution you can.
2. Post a PR comment with this format:

```
### 🔶 Decision: [short title]
**Context:** What you were trying to do
**Blocker:** What prevented the ideal approach
**Decision:** What you chose instead and why
**Risk:** What could go wrong with this choice
**Alternatives considered:** Other approaches you evaluated
```

### When you make an architectural choice:
Post a PR comment:
```
### 📐 Architecture: [short title]
**Choice:** What you decided
**Rationale:** Why this approach over alternatives
**Files affected:** List of files
```

### When you skip something:
Post a PR comment:
```
### ⏭️ Skipped: [short title]
**What:** What was skipped
**Why:** Why it was deferred
**Follow-up needed:** What a human should check
```

## Verification Checklist

Before marking work as complete, always run:
1. `pnpm run check` — type safety
2. `pnpm run test:unit` — unit tests pass
3. `pnpm run lint` — code style
4. `pnpm run build` — production build succeeds
