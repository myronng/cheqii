---
trigger: always_on
---

# Testing Standards

To ensure consistency and maintainability across the test suite, follow these guidelines when writing unit and component tests.

## Testing Lifecycle & Commands

Every testing task performed by the agent must conclude with verification using the project's specific `pnpm` scripts. **Do not run raw vitest or playwright commands; use the aliases defined in `package.json`.**

### 1. Mandatory Pre-flight Check

Before writing or running tests, ensure the SvelteKit environment is synced and type-safe:

- `pnpm run check`: Syncs SvelteKit and runs `svelte-check` for type integrity.

### 2. Execution Scripts

- **Full Suite**: `pnpm run test` (Runs both Integration and Unit tests).
- **Unit Tests Only**: `pnpm run test:unit` (Runs `vitest --run`). Use this while iterating on logic or Svelte 5 runes.
- **Integration/E2E**: `pnpm run test:integration` (Runs `playwright test`). Use this for testing cross-page flows or Supabase auth cycles.

### 3. Code Quality & Formatting

After tests pass, ensure the code follows project styling:

- `pnpm run lint`: Checks formatting and runs `oxlint`.
- `pnpm run format`: Automatically fixes formatting issues with Prettier.

## Shared Data and Mocks

Do not create ad-hoc mock data within test files if reusable alternatives exist.

- **Supabase Mocks**: Use [createMockSupabase](cci:1://file:///home/myron/Documents/cheqii/src/lib/utils/common/testMocks.ts:296:0-307:3) from [src/lib/utils/common/testMocks.ts](cci:7://file:///home/myron/Documents/cheqii/src/lib/utils/common/testMocks.ts:0:0-0:0).
- **Bill Data**: Use `MOCK_BILL_DATA_COMPLEX`, `MOCK_BILL_DATA_SIMPLE`, etc., from [src/lib/utils/common/testMocks.ts](cci:7://file:///home/myron/Documents/cheqii/src/lib/utils/common/testMocks.ts:0:0-0:0).
- **Allocations**: Use `MOCK_ALLOCATIONS` from `src/lib/utils/common/testMocks.ts`.

Example:

```typescript
import {
  createMockSupabase,
  MOCK_BILL_DATA_COMPLEX,
} from "$lib/utils/common/testMocks";
```

## Localization

Do not hardcode strings in tests. Use the shared localization utilities to ensure tests remain resilient to copy changes and verify internationalization support.

- **Mock Strings**: Use `getTestStrings()` from [src/lib/utils/common/locale.test.ts](cci:7://file:///home/myron/Documents/cheqii/src/lib/utils/common/locale.test.ts:0:0-0:0) (or relevant helper) to retrieve the full set of locale strings.
- **Interpolation**: Use `interpolateString` from `src/lib/utils/common/locale.ts` for strings with placeholders.

Example:

```typescript
import { interpolateString } from "$lib/utils/common/locale";
import { getTestStrings } from "$lib/utils/common/locale.test";

const mockStrings = getTestStrings();
const title = interpolateString(mockStrings["item{index}"], { index: "1" });
```

## Selectors

- **Accessibility**: Prefer accessible selectors like `getByRole`, `getByLabelText`, and `getByTitle`.
- **Robustness**: Use the interpolated strings for selectors to ensure they match what the user sees and to keep tests aligned with [localeStrings.json](cci:7://file:///home/myron/Documents/cheqii/src/lib/utils/common/localeStrings.json:0:0-0:0).
- **Dynamic Elements**: For lists of items, construct the expected string dynamically using loop indices and locale helpers.
