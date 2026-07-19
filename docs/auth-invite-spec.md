# Auth & Invite Spec (v2)

How users get an identity, how bills are shared, and who can read/write what. This redesign keeps the frictionless anonymous-first UX but closes several access-control holes in v1 and replaces the bill-wide shared invite secret with proper capability tokens.

## Goals

- **Frictionless start:** a first-time user can create and edit a bill with zero sign-up (anonymous), and only later attach a real identity.
- **No data loss on upgrade:** signing in with Google after working anonymously must carry the anonymous work forward.
- **Least privilege by default:** sharing a link should not silently make a bill world-writable.
- **Revocable, scoped sharing:** invites can expire, be limited, and be revoked per recipient.
- **Defense in depth:** RLS is the backstop; app-layer checks are belt-and-suspenders, never the only gate.

---

## 1. v1 model (as built)

### Identities

- **Anonymous** — `supabase.auth.signInAnonymously({ captchaToken })` gated by an **invisible Cloudflare Turnstile** widget. On success the client inserts a `users` row and seeds local `UserData`. This is the _default_ path: any protected page sets an `authRedirect` cookie (5 min) and bounces to `/auth`, which auto-runs anonymous sign-in and bounces back.
- **Google** — One-Tap (`signInWithIdToken`, provider `google`) with a correctly-implemented nonce (hashed nonce → Google, raw nonce → Supabase, FedCM enabled). Offered opportunistically, not on the `/auth` page.
- **Offline fallback** — if Turnstile/`signInAnonymously` throws, `signInAnonymously()` swallows the error and mints a **local-only** user with `crypto.randomUUID()` — not registered in Supabase auth.

### Authority levels (`bill_authority` enum)

`owner` | `invited` | `public`, stored per `(bill_id, user_id)` in `bill_users`.

### Access functions (RLS calls these on every table)

- `check_user_has_bill_read_access` → member with authority in (`owner`,`invited`,`public`) **OR** `check_bill_allows_any_access`.
- `check_user_has_bill_write_access` → member with authority in (`owner`,`invited`) **OR** `check_bill_allows_any_access`.
- `check_bill_allows_any_access` → `bills.invite_required = false` **OR** the bill has **zero `owner` rows**.

### Invite flow

- Each bill has **one** `invite_id` (a UUID). The link is `/invite/<inviteId>/<billId>`.
- `/invite/...` server load: requires a session (else redirect to `/auth` with return cookie), then calls `join_bill_via_invite(bill, invite, user)` which validates `invite_id` matches, inserts/updates the caller as `invited` (upgrading a prior `public` membership), and redirects to the bill.
- Regenerating the invite link changes `invite_id` → all existing links die at once.

### Account/contributor linking

- A bill starts with anonymous **contributors** (column headers). `link_contributor_account(bill, oldContributorId, newUserId)` **rewrites the contributor's primary key** to the user's id and repoints `bill_items.contributor_id` and `bill_item_splits.contributor_id`. Invoked via the `UPDATE_CONTRIBUTOR` sync mutation. This is how an anonymous slot becomes "you."

---

## 2. Sharp edges in v1 (must address)

> These are the reasons the auth layer needs a redesign, not just a port.

1. **`invite_required = false` makes a bill world-WRITABLE, not just readable.** Write access ORs in `check_bill_allows_any_access`, which is true whenever `invite_required = false`. So a "public" bill can be edited by _any_ authenticated user — and because anonymous sign-in is frictionless + invisible-captcha, "any authenticated user" is effectively "anyone on the internet." The `public` authority level (read-only intent) is therefore meaningless for writes.

2. **The "no owner ⇒ open access" bypass collides with resilient sync.** `check_bill_allows_any_access` returns true when a bill has zero `owner` rows. The resilient sync RPCs deliberately create **owner-less ghost bills** (`INSERT INTO bills … 'Syncing…'`) on out-of-order mutations. That opens a window where ghost/half-created bills are world-readable **and** world-writable. The comment assumes this only happens "during initial insert"; resilient sync makes it happen routinely.

3. **Invite = one bill-wide shared secret.** No expiry, no max-uses, no per-recipient tokens, no individual revocation (only nuke-everyone regeneration). The token sits in the URL path → leaks via browser history, referrer headers, and server logs. Anyone who ever sees the link gains permanent `invited` (full write).

4. **Google sign-in likely orphans anonymous work.** `signInWithIdToken` authenticates as the Google identity — a _different_ `user_id` than the anonymous one. Bills created anonymously are owned by (and synced under) the anon id; after Google sign-in the user is a new principal who doesn't own them. The only bridge is the manual, per-slot `link_contributor_account`. There's no automatic anonymous→permanent upgrade.

5. **PK-rewriting in `link_contributor_account` is fragile.** Mutating a primary key and cascading the change is risky in general and especially under multi-device sync (peers hold splits referencing the old id; the rename must propagate as a structural mutation). It also has **no guard that `p_new_user_id` is the caller** — a client could set `new_user_id` to an arbitrary id.

6. **Turnstile only gates account creation,** not the `/api/sync` write path. Once an anon account exists, it can fire unlimited mutations. No rate limiting.

7. **Offline-fallback users can never sync** (no JWT) — their outbox grows unbounded with no recovery path or user-visible warning.

8. **`SECURITY DEFINER` audit needed.** `join_bill_via_invite`, `link_contributor_account`, `get_full_bill`, and the access checks run as definer/invoker in a mix; each should be explicitly chosen and minimal. `get_full_bill` relies on a downstream JS `isMember` check in the API route rather than its own authorization.

---

## 3. v2 design

### 3.1 Identity model

- **Anonymous-first, unchanged UX.** Keep invisible Turnstile on anonymous sign-up.
- **Anonymous → permanent upgrade via `linkIdentity`.** Use Supabase identity linking so the Google identity attaches to the _same_ `user_id`. The anonymous user's bills, memberships, and synced mutations all carry over automatically — no orphaning, no manual slot-claiming for the common case.
- **`link_contributor_account` becomes the exception path** only (claiming a slot someone _else_ created for you), and is hardened (see 3.4). Prefer not to rewrite PKs: instead store a `linked_user_id` column on `bill_contributors` and resolve identity by that, leaving the contributor's own id stable. This is friendlier to the sync engine (no structural key churn).

### 3.2 Explicit roles, no implicit bypass

- Replace the two-branch OR access model with an explicit **role** per member: `owner` | `editor` | `viewer`. (`invited`→`editor`, `public`→`viewer`.)
- **Read access** = membership with any role, OR bill visibility is `public` (read).
- **Write access** = membership with `owner`/`editor`. **Never** granted by `invite_required = false` and **never** by absence of an owner.
- A `public` bill means _viewers can read_; it never implies world-write. To allow public editing, that must be an explicit bill setting (`public_can_edit`), off by default.
- **Kill the owner-less bypass.** Bills are always created with their owner atomically (`CREATE_BILL` already inserts the owner). Ghost/stub rows created by resilient sync must be **non-readable** until materialized — e.g. a `is_stub`/`materialized` flag (shared with the sync v2 spec) that the access checks treat as "no access for anyone but the system."

### 3.3 Capability-based invites

- Invites become rows in an `invites` table: `{ id (token), bill_id, role, created_by, expires_at, max_uses, uses, revoked_at }`.
- Tokens are **high-entropy, single-purpose**, delivered in the URL **fragment or a POST**, not a logged path segment where practical.
- `join_bill_via_invite(token, user)` validates: token exists, not revoked, not expired, under `max_uses`; then adds the caller with the invite's `role` and increments `uses`. Idempotent for repeat joins.
- Multiple concurrent invites per bill (e.g. an editor link and a viewer link), each independently revocable. Regenerating one doesn't break the others.

### 3.4 Hardening

- `link_contributor_account` (and the `linked_user_id` write): **assert the new identity is the caller** (`auth.uid()`), and that the caller has write access to the bill. `SECURITY DEFINER` with a strict internal check.
- All `SECURITY DEFINER` functions: explicit `search_path`, minimal grants, and an authorization check as their first statement.
- `get_full_bill`: authorize inside the function (or keep it `SECURITY INVOKER` so RLS applies) — don't depend solely on a JS membership check downstream.
- **Rate-limit `/api/sync`** per user (and optionally require a periodic fresh Turnstile token for anonymous principals) to blunt mutation spam.
- **Offline-only users:** detect the "no real session" state, surface a "sign in to sync" prompt, and reconcile the local UUID into a real anon/permanent identity when connectivity returns (replay the outbox under the new id).

### 3.5 Session plumbing (keep from v1)

- Server `hooks.server.ts`: per-request Supabase server client from cookies; `safeGetSession()` validates the JWT via `getUser()` (not just `getSession()`). Keep.
- `ssr = false` globally — the app is a local-first SPA. Keep, but note the SEO/first-paint tradeoff; the marketing/landing route could opt back into SSR.

---

## 4. Access matrix (v2 target)

| Action                         | viewer | editor | owner | non-member (public-read bill) | non-member (private bill) |
| ------------------------------ | ------ | ------ | ----- | ----------------------------- | ------------------------- |
| Read bill                      | ✅     | ✅     | ✅    | ✅                            | ❌                        |
| Edit items/splits/contributors | ❌     | ✅     | ✅    | ❌ (unless `public_can_edit`) | ❌                        |
| Manage invites / roles         | ❌     | ❌     | ✅    | ❌                            | ❌                        |
| Delete bill                    | ❌     | ❌     | ✅    | ❌                            | ❌                        |
| Join via valid invite          | —      | —      | —     | becomes role from token       | becomes role from token   |

---

## 5. Acceptance scenarios

1. **Anon → Google upgrade preserves data:** create 2 bills anonymously, sign in with Google → same `user_id`, both bills still owned and editable; no re-link needed.
2. **Expired invite rejected:** a link past `expires_at` returns "invalid invitation," no membership created.
3. **Revoked invite rejected** while a sibling invite for the same bill still works.
4. **Viewer cannot write:** a `viewer` member's mutations are rejected by RLS and by `/api/sync`.
5. **Public bill is read-only by default:** a non-member can open a public bill but every write is denied unless `public_can_edit` is set.
6. **Ghost bill is not accessible:** a stub bill created by an out-of-order mutation is invisible/inaccessible to everyone until materialized.
7. **Slot claim is authorized:** linking a contributor slot to a user other than the caller is rejected.
8. **Offline user is warned and recovers:** an offline-fallback user sees a sync prompt and, on reconnect, their queued mutations apply under a real identity.
9. **Invite token not leaked in logs:** joining does not place the secret in a server-logged path (verify transport choice).

---

## 6. Open decisions

- **Identity linking vs. fresh user on Google sign-in:** confirm Supabase `linkIdentity` covers the anon-upgrade flow in the target Supabase version; if not, design an explicit server-side migration of `user_id` references.
- **`public_can_edit`** — is anonymous public _editing_ an actual product feature, or should public always be read-only? (v1 effectively allowed public editing by accident.)
- **Invite delivery** — fragment vs. short-lived signed token vs. emailed magic link. Affects leak surface.
- **Turnstile on sync** — acceptable UX cost vs. bot-abuse risk for a free anonymous app.
- **Contributor identity** — adopt `linked_user_id` (recommended) vs. keep PK rewrite. Coordinate with the data-model spec.
