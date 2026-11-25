# Snow Window

A board for finding when a crew can go skiing or snowboarding in the 2026–27 season (Pyrenees, Sierra Nevada, Andorra). Someone starts a crew and shares its invite link; each person picks a name and an emoji, taps or drags across the timeline to mark the days they're free, and the board shows where everyone overlaps. Spanish and Catalan holidays, weekends and a few chosen dates (the Scopely winter break) are highlighted.

## Use

One screen, four tabs: **Board** (timeline + details), **Snow windows** (best stretches, holidays), **Trips** (suggestions and answers), **Resorts** (7-day forecast and live webcams).

- **Crews**: start one with a name, then *Copy invite link*. Anyone with the link can join (up to 20 people) and share it on. You can be in several crews; your free days are one calendar shared by all of them. The person who started a crew can rename it, remove people and make a new link (the old one stops working). Anyone can leave; when the starter leaves, the crew passes to the longest-standing member.
- **Mark days**: tap a day in your row to toggle it; drag to fill a stretch, or drag from a marked day to clear one.
- **Whole crew row**: how many are free each day; a green ✓ when everyone who has marked days is free.
- **Snow windows**: the longest stretches when everyone is free (or, failing that, the most people), with nights, weekend days and holidays inside.
- **Snow forecast row**: pick a resort (Baqueira, La Molina, Grandvalira, Pal Arinsal, Formigal, Cerler, Sierra Nevada); each day within 16 days shows the sky, snowfall and max temperature from [Open-Meteo](https://open-meteo.com/). Days with 5 cm or more of fresh snow light up orange. Tapping a day lists every resort.
- **Trips tab**, two views. *Suggest*: the season timeline with the crew's overlap and a **New trip** row instead of people, where the days someone is free show as options; tap the first day, then the last, or pick one of the best stretches under it (one tap is a day trip; a mouse can drag), pick a resort (its forecast shows on the timeline), add a plan and, when staying over, a place: link, € per person per night, note. *Answer*: every trip as a card with the resort's photo, Going / Maybe / Can't per row you own, the tally and who's free for all of it. The proposer marks it *on*, reopens or cancels it. Up to 14 days per trip, 40 trips.
- **Resorts tab**: the seven resorts sorted by snow in the next week, each with a photo, travel from Barcelona by car, bus and train (time, km, direct or with a change; the route on hover), its own live-webcam page and a webcam archive. All in `src/config/resorts.ts`, checked 2026-11-25. Travel times are approximate (Rome2rio and operator pages; Alsa's site couldn't be checked, and the R3 line has replacement buses until 2028).
- **Guest first.** The first visit signs you in as a guest on that device, no form. *You* → *Save your account* links Google or an email so the crews survive a cleared browser; on another device, *I already have an account* signs in with Google or an emailed link. Spec: `docs/spec/auth-and-crews.md`.

## Develop

```bash
bun install
bun run dev        # http://localhost:5191, demo mode: crews saved in this browser
bun run test       # logic + migration (PGlite, no Docker needed)
bun run typecheck
bun run lint
```

Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` the app runs on `LocalStore` (localStorage). With them it uses `SupabaseStore`.

## Data

Schema `app_snow_window` in the shared Supabase sandbox (`~/projects/supabase-sandbox`), migration `supabase/migrations/20261125160000_app_snow_window__init.sql`. Visitors sign in anonymously (`signInAnonymously` with `data.app`), so every request carries a user. Tables `profiles`, `crews`, `crew_members`, `trips`, `responses` have read policies scoped to the crews you share; every write goes through security-definer functions (`save_profile`, `set_days`, `create_crew`, `crew_preview`, `join_crew`, `rename_crew`, `reset_invite`, `remove_member`, `leave_crew`, `get_crew`, `create_trip`, `respond`, `set_trip_status`) that enforce the limits: 20 people per crew, 10 crews started and 20 joined per person, 40 trips per crew, names ≤ 24 characters, days inside 1 Dec 2026 – 30 Apr 2027. In demo mode, stores sharing localStorage act as different people by the `snow-window:local:me` key.

## Look

The interface uses the illustrated Pyrenees panorama and Snow Window wordmark, with indigo ink, warm paper, teal availability marks and apricot highlights. Shared colors are defined in `src/style.css`. Artwork and generation prompts are in `public/art/`. The calendar’s **Go to month** control jumps across the season, and **Calendar key** explains its markings. Resort photos in `public/resorts/` come from Wikimedia Commons under free licences; each card credits its author and licence and links the source page.

## Calendar

Season, holidays and highlighted dates live in `src/config/calendar.ts`. The season range is repeated in the `set_days` function of the migration; change both.

## Deploy

GitHub Pages via `.github/workflows/deploy.yml`, with repo secrets `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. The migration is pushed from the sandbox repo (`scripts/assemble.sh`), never from here.
