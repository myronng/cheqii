---
trigger: always_on
---

# Package Manager Consistency

This project strictly uses `pnpm` as the sole package manager. `npm` and `yarn` are not permitted for dependency management, script execution, or workspace orchestration.

## Instructions

1. **Command Selection**: Always use `pnpm` equivalents for any package management task.
   - Use `pnpm install` instead of `npm install`.
   - Use `pnpm add <pkg>` instead of `npm install <pkg>`.
   - Use `pnpm dlx` instead of `npx`.
   - Use `pnpm run <script>` instead of `npm run <script>`.
2. **File Awareness**: If you detect a `package-lock.json` or `yarn.lock`, do not update them. Instead, alert the user that these should be removed in favor of `pnpm-lock.yaml`.
3. **Workspace Management**: When working with monorepos, utilize `pnpm` workspace syntax (e.g., `--filter`).
4. **Execution**: Before running any command that modifies `node_modules`, ensure the `pnpm` environment is active.

## Examples

- **Wrong**: `npm install lodash`
- **Right**: `pnpm add lodash`
- **Wrong**: `npx shadcn-ui@latest init`
- **Right**: `pnpm dlx shadcn-ui@latest init`
