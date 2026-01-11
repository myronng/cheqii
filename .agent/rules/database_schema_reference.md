## Supabase Schema Reference Rule

For any Supabase-related changes, including querying, modifications, or creating database functions (RPCs), always refer to the schema definitions in `src/lib/utils/models/database.ts`.

### Sources of Truth

1.  **TypeScript Types**: [database.ts](file:///home/myron/Documents/cheqii/src/lib/utils/models/database.ts) is the single source of truth for table names, column names, data types, and RPC signatures.
2.  **SQL Definitions**: All custom SQL logic is organized in [src/lib/utils/supabase/](file:///home/myron/Documents/cheqii/src/lib/utils/supabase/):
    - `udf.sql`: User Defined Functions (RPCs) for atomic operations.
    - `views.sql`: Flattened, sorted views of related table data.
    - `rls.sql`: Access control helper functions and Table Policies.
    - `triggers.sql`: Automated timestamp management and audit triggers.

### Deployment & Execution Order

To maintain data integrity and satisfy dependencies, SQL files **MUST** be executed in the following order:

1.  **`udf.sql`**: Core logic and basic functions.
2.  **`views.sql`**: Depends on table structures and core items.
3.  **`rls.sql`**: Depends on helper functions (often defined in UDFs) and policies.
4.  **`triggers.sql`**: Final layer for automated side effects.

### Development Best Practices

- **Idempotency**: Always include `DROP [FUNCTION|VIEW|TRIGGER|POLICY] IF EXISTS` at the start of scripts to prevent overloading (e.g., `PGRST203` errors) and ensure clean updates.
- **Security Context**:
  - Use `SECURITY INVOKER` for RPCs to respect Row Level Security.
  - Use `SECURITY DEFINER` with `SET search_path = public` for RLS helper functions to allow internal checks regardless of user permissions.
- **Performance**: Mark RLS helper functions as `STABLE` to allow PostgreSQL to cache results during row-by-row policy evaluation.
- **Views & RLS**: Always define views `WITH (security_invoker = TRUE)` to ensure they respect the RLS policies of the underlying tables.
- **Casing**: Always match the exact casing in `database.ts` (e.g., `bill_id`, `invite_required`).
