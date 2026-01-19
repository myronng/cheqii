---
trigger: always_on
---

# Supabase Schema Reference Rule

For any Supabase-related changes, including querying, modifications, or creating database functions (RPCs), always refer to the schema definitions in `src/lib/utils/models/database.ts`.

## Sources of Truth

1.  **TypeScript Types**: [database.ts](file:///home/myron/Documents/cheqii/src/lib/utils/models/database.ts) is the single source of truth for table names, column names, data types, and RPC signatures.
2.  **Migration Files**: All custom SQL logic is organized in chronological order in [supabase/migration/](file:///home/myron/Documents/cheqii/supabase/migration/):

## Workflow Rules

1. **No Direct Edits:** Never attempt to create or modify files in `supabase/migrations/` manually unless specifically asked to fix a syntax error in an existing migration.
2. **Local First:** Always apply SQL changes to the local development database first to validate syntax.
3. **Migration Generation:** Use the Supabase CLI to capture changes. After applying a change locally, run:
   `supabase db diff -f <descriptive_name>`
4. **Naming Convention:** The CLI will automatically prefix the filename with the required timestamp (e.g., `20260117083000_name.sql`). Ensure the `<descriptive_name>` part is lowercase and snake_case (e.g., `add_user_profile_trigger`).
5. **Idempotency:** Ensure all custom SQL written for migrations uses `CREATE OR REPLACE` for functions/views and checks for existence (e.g., `DO $$BEGIN ... END$$`) for policies or columns to prevent migration failures.

## Development Best Practices

- **Idempotency**: Always include `DROP [FUNCTION|VIEW|TRIGGER|POLICY] IF EXISTS` at the start of scripts to prevent overloading (e.g., `PGRST203` errors) and ensure clean updates.
- **Security Context**:
  - Use `SECURITY INVOKER` for RPCs to respect Row Level Security.
  - Use `SECURITY DEFINER` with `SET search_path = public` for RLS helper functions to allow internal checks regardless of user permissions.
- **Performance**: Mark RLS helper functions as `STABLE` to allow PostgreSQL to cache results during row-by-row policy evaluation.
- **Views & RLS**: Always define views `WITH (security_invoker = TRUE)` to ensure they respect the RLS policies of the underlying tables.
- **Casing**: Always match the exact casing in `database.ts` (e.g., `bill_id`, `invite_required`).

## Supabase Type Management

- **No Manual Edits**: Strictly forbid manual modifications to the `database.types.ts` (or equivalent) file.
- **Automated Generation**: After any schema change (migration), you must run the following command to synchronize the TypeScript definitions:
  ```bash
    pnpm run types:dev
  ```
- **Verification**: Once the types are regenerated, verify that any related Svelte 5 components or server-side scripts are not showing type errors before finalizing the task.

## Reference Commands

- **Create empty migration:** `pnpx supabase migration new <name>`
- **Diff local changes:** `pnpx supabase db diff -f <name>`
- **Reset local environment:** `pnpx supabase db reset` (Use this to verify migrations run cleanly from scratch).
