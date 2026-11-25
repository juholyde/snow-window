# AGENTS.md

Public ski-trip availability board. Read README.md first.

## Rules of this repo

- **The database enforces the guardrails.** The publishable key ships in a public page and there is no sign-in, so a limit that exists only in the client is not a limit. Anonymous visitors reach `app_snow_window` only through security-definer functions; never add a table policy for `anon`. Change the SQL first, with a test in `tests/migration.test.ts`, then mirror the limit in `src/lib/rules.ts` (used by `LocalStore`).
- **Migrations** are named `<ts>_app_snow_window__<what>.sql`; ones that add tables end with `select platform.gate_tables('snow_window');`. Push them from `~/projects/supabase-sandbox`, never from this repo.
- **Stable error codes.** Functions raise short codes (`board_full`, `not_your_row`, `day_outside_season`); `src/lib/supabaseStore.ts` maps them to copy.
- **Tests ship with logic.** `bun run test`, `bun run typecheck` and `bun run lint` (Biome) pass before a commit. Lint errors fail; warnings do not.
- **Stack** follows the wiki's tech-stack page: Vue 3 + TypeScript + Vite on Bun, Vitest, Biome, GitHub Pages + Supabase sandbox.
- **Never** commit a service-role key. The publishable key is public by design.
