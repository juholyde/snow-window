# Snow Window

A public board for finding when a group can go skiing or snowboarding in the 2026–27 season (Pyrenees, Sierra Nevada, Andorra). Each person adds a row with a name and an emoji, taps or drags across the timeline to mark the days they're free, and the board shows where everyone overlaps. Spanish and Catalan holidays, weekends and a few chosen dates (the Scopely winter break) are highlighted.

## Use

- **Add yourself**: name + emoji. Up to 20 people.
- **Mark days**: tap a day in your row to toggle it; drag to fill a stretch, or drag from a marked day to clear one.
- **Whole crew row**: how many are free each day; a green ✓ when everyone who has marked days is free.
- **Snow windows**: the longest stretches when everyone is free (or, failing that, the most people), with nights, weekend days and holidays inside.
- **No sign-in.** Adding a row gives this device an edit token. ⋯ → *Copy edit link* opens your row on another device.

## Develop

```bash
bun install
bun run dev        # http://localhost:5191, demo mode: board saved in this browser
bun run test       # logic + migration (PGlite, no Docker needed)
bun run typecheck
bun run lint
```

Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` the app runs on `LocalStore` (localStorage). With them it uses `SupabaseStore`.

## Data

Schema `app_snow_window` in the shared Supabase sandbox (`~/projects/supabase-sandbox`). Visitors are anonymous: the `people` table has no policies, so nobody reads or writes it directly. Everything goes through security-definer functions (`get_board`, `add_person`, `set_days`, `remove_person`) that enforce the guardrails: at most 20 people, names ≤ 24 characters, days inside 1 Dec 2026 – 30 Apr 2027, and edits only with the row's token. The token is never returned by `get_board`.

## Calendar

Season, holidays and highlighted dates live in `src/config/calendar.ts`. The season range is repeated in the `set_days` function of the migration; change both.

## Deploy

GitHub Pages via `.github/workflows/deploy.yml`, with repo secrets `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. The migration is pushed from the sandbox repo (`scripts/assemble.sh`), never from here.
