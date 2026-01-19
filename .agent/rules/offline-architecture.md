---
trigger: always_on
---

# Offline-First Data Architecture (IndexedDB + Supabase)

## Core Principle

IndexedDB is the Primary Source of Truth (SoT) for the UI. Supabase is the Remote SoT. The UI must never wait for a network round-trip to update.

## 1. Data Flow: "Write-Local-Apply-Remote"

All mutations must follow this strict sequence:

1. **Local Commit**: Write the change to the local IndexedDB store.
2. **Queue**: Add the mutation (method, table, payload, timestamp) to an `outbox` table in IndexedDB.
3. **Optimistic UI**: Update Svelte `$state` immediately after the Local Commit.
4. **Sync**: Trigger the background sync coordinator if `navigator.onLine` is true.

## 2. Sync Hierarchy & Conflict Handling

- **Timestamp Priority**: Every record must include an `updated_at` (ISO-8601) field.
- **Last-Write-Wins**: By default, compare local `updated_at` with remote. Only push to Supabase if local is newer.
- **Atomic Transactions**: When writing to IndexedDB, use transactions to ensure the data store and the `outbox` stay in sync.

## 3. Svelte 5 Integration

- Use `$state` to reflect the current view of IndexedDB.
- Use `$effect` to watch the `outbox` size. When `outbox.length > 0` and network is available, initiate a `POST` to the Cloudflare Worker sync endpoint.

## 4. Identity & Primary Keys

- **No Auto-Increment**: Strictly forbid the use of integer-based auto-incrementing IDs in the database schema.
- **Client-Generated UUIDs**: All primary keys must be generated on the client using `crypto.randomUUID()`.
- **Supabase Schema**: Corresponding columns in PostgreSQL must be of type `UUID` and set to `PRIMARY KEY`.
- **Foreign Keys**: Relationships must be established locally using these generated UUIDs before sync.

## 5. Security & ID Integrity

- **RLS Mandatory**: Client-generated IDs must never be trusted as a proof of ownership. All Supabase tables must have Row Level Security (RLS) enabled, checking `auth.uid()` against a `user_id` column.
- **Ownership Verification**: When syncing, the Cloudflare Worker must explicitly inject the authenticated `user_id` into the payload before pushing to Supabase to prevent "cross-user" ID spoofing.
- **Non-Enumerable IDs**: Use UUIDs exclusively to prevent ID-guessing/harvesting attacks.
