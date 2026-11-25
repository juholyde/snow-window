# Spec: sign-in and crews

Status: agreed 2026-11-25, building. Replaces the public no-sign-in board (never deployed).

A **crew** is a named group of friends planning trips together. Everyone signs in, at first as a guest with no form to fill. A person has one calendar of free days that every crew they belong to sees. Anyone in a crew can share its invite link; the person who made the crew manages it.

## Decisions (Juho, 2026-11-25)

| Question | Decision |
|---|---|
| Sign-in | Guest first: an anonymous Supabase account, created on the first visit. *Save your account* with Google or an email link keeps their crews on other devices |
| Free days | One calendar per person, shared by all their crews |
| Old public board | Replaced. Its migrations were never pushed, so they are rewritten, not migrated. `LocalStore` demo mode stays for development and tests |
| Crew admin | The creator renames the crew, resets the invite link and removes members. Anyone can leave. Invite links don't expire |
| Crews per person | Any number (guardrail: 10 created, 20 joined) |
| Crew size | 20 people, the old board limit |

## Sign-in path

1. **First visit, no session.** The client calls `auth.signInAnonymously({ options: { data: { app: 'snow_window' } } })`. The sandbox's `handle_new_user` trigger adds the `snow_window` membership because the app has `join_mode = open` and `allow_anonymous = true`. Then `refreshSession()`, so the JWT carries `apps.snow_window`.
2. **Profile.** Before creating or joining a crew, the person picks a name and an emoji (stored in `profiles`).
3. **Save your account.** For a guest, the banner asks for an email: `auth.updateUser({ email }, { emailRedirectTo })`. Supabase emails a confirmation link; after it, the same user id is a permanent account. Nothing is moved.
   *Save with Google* calls `auth.linkIdentity({ provider: 'google', options: { redirectTo } })`: the Google identity joins the same user id, so crews stay. If that Google account is already a sandbox user, Supabase returns `identity_already_exists` in the redirect hash; `main.ts` reads it before supabase-js and the app says to use *Sign in with Google* instead.
4. **Another device.** *Sign in with Google* calls `auth.signInWithOAuth`; `session()` then calls `platform.join_app` if the account isn't in `snow_window` yet. *Sign in* by email sends a magic link: `auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo } })`. If that device already had a guest account with crews, those are left behind. Merging guests is out of scope.
5. **Sign out** is offered only to saved accounts. A guest who signs out loses the account, so they get a warning first.

Rate limit: the sandbox allows 30 anonymous sign-ins per hour per IP address, which is fine for a group of friends.

**Decided 2026-11-25 (t15):** guests can save with Google. This needs `enable_manual_linking = true` in the sandbox auth config, which applies to every sandbox app: any signed-in user can attach another login to their own account. Until that config is pushed, *Save with Google* answers `manual_linking_disabled` and the app suggests email.

## Invite path

- Every crew has an `invite_code`, a random UUID. Its link is `<app>/#join=<code>`.
- Opening the link signs you in as a guest if needed. `crew_preview(code)` then shows the crew name, its member count and their emojis, without joining.
- *Join* calls `join_crew(code)`. If you have no profile yet, you pick a name and an emoji first. Joining twice is a no-op. The 21st member gets `crew_full`.
- The creator's *Reset link* sets a new code, and the old links stop working.

## Data (schema `app_snow_window`)

| Table | Columns | Notes |
|---|---|---|
| `profiles` | `user_id` pk → auth.users, `name` ≤ 24, `emoji` ≤ 16, `days date[]` within the season, `updated_at` | One per person |
| `crews` | `id`, `name` ≤ 40, `owner_id` → auth.users, `invite_code uuid`, `created_at` | |
| `crew_members` | `crew_id`, `user_id`, `joined_at`, pk (crew_id, user_id) | Owner is a member |
| `trips` | as `suggestions` before, plus `crew_id`; `proposer_id` → auth.users | 40 per crew |
| `responses` | `trip_id`, `user_id`, `answer` | |

Access: RLS on every table, plus the sandbox's `app_gate` (membership of the `snow_window` app). Reads go straight to tables through RLS, which shows only the crews you're in and the profiles of people who share a crew with you. Writes that carry rules go through security-definer RPCs that use `auth.uid()`: `create_crew`, `crew_preview`, `join_crew`, `rename_crew`, `reset_invite`, `remove_member`, `leave_crew`, `save_profile`, `set_days`, `create_trip`, `respond`, `set_trip_status`. Stable error codes: `crew_full`, `too_many_crews`, `bad_invite`, `not_owner`, `not_member`, `day_outside_season`, `trips_full`, `trip_closed`, `not_your_trip`.

If the creator leaves, the crew passes to the longest-standing member. When the last member leaves, the crew is deleted.

## UI

- **Topbar:** a crew switcher (crew name ▾; *New crew*) and a profile button (emoji: edit name/emoji, *Save your account* / *Sign in* / *Sign out*).
- **No crew yet:** a welcome card: name + emoji, crew name, *Create crew*. An invite link instead shows *Join <crew>*.
- **Board:** the crew's members as rows; your row is the editable one (no more *Add yourself*, no edit tokens, no claim links).
- **Crew panel** (Board side): members, *Copy invite link* for everyone; *Rename*, *Reset link*, *Remove* for the creator; *Leave crew*.
- Trips, Snow windows and Resorts work as before, scoped to the current crew.
- The current crew is remembered per device (localStorage).

## Not in scope

Merging guest accounts; Apple sign-in; per-crew roles beyond creator; invite expiry; email notifications.
