# Phone walkthrough, 2026-11-27 (task t25)

Playwright (headless Chromium, 390x844, mouse events; no touch emulation) against the local demo (LocalStore).
Seed: a 19-member crew with 24-character names (Greek, accents, emoji, Nordic), varied free days, three trips (open, on, day trip).
A fresh guest then joined by `#join=<code>` as the 20th member, marked days by tap and drag, answered a trip and suggested one.

Overflow: `document.documentElement.scrollWidth` was 390 (innerWidth 390) on Board, Windows, Trips (Suggest and Answer), Resorts and the crew sheet. No horizontal page overflow. Sticky header rows (month, day, whole-crew, forecast) and the name column hold while scrolling both ways.

## Screenshots

| File | Shows |
|---|---|
| 01-invite-landing.png | Fresh guest opens the invite: crew name wraps to 3 lines, avatar grid, name field |
| 02-after-join.png | Board right after joining (20/20): toast covers the bottom rows |
| 03-own-row.png | Own row at the bottom of 20; sticky rows above it |
| 04-marked-days.png | One tap (6 Dec) and one drag (8-11 Dec) on the own row: both worked |
| 06-answer-cards-clipped-before-fix.png | BUG: Answer view squeezed every card to 186px, hiding the Going/Maybe/Can't buttons |
| 07-answer-card-after-fix.png | Same card after the one-line fix `grid-auto-rows: max-content` in src/style.css |
| 09-suggest-range-picked.png | Suggest: tapped first (3 Dec) and last day (7 Dec): range and "0 free" summary |
| 11-after-suggest.png | After "Suggest to the crew": lands on Answer at the top, new trip not in view |
| 12-crew-sheet.png | Crew sheet with 20 long names: all fit in full, crew name wraps |
| 14-board-scrolled-right.png | Board scrolled to Jan: header rows hold; only 6 of 20 rows visible |

## Friction

1. FIXED here: Answer view clipped trip cards (grid rows shrank to fit the screen), so with 3+ trips on a phone you could not reach the answer buttons or scroll. Only the one-line CSS fix is in this commit.
2. Board name column is 75px of text: 19 of 20 names truncate to about 8 characters ("Maximili...", "Ingebor..."), even "Whole crew" truncates. Two people sharing a first word look identical (I had two "Ingebor..."). No way to read a full name on the board; only the crew sheet shows them.
3. Own row shows "Inge... / you · 6..." because the row menu button eats the name width.
4. Board shows about 6 of 20 rows at once: masthead, tabs, banner, title and the 180px sticky header use ~60% of the screen. Own row is at the bottom, so a new guest has to scroll to find where to tap; nothing scrolls to it.
5. Joining drops you on the Board with a toast that hides the bottom rows; the "tap or drag your row" help sits in the toast and a footer, easy to miss.
6. Own-row cells use `touch-action: none`: a vertical swipe that starts on your own row cannot scroll the board. Not testable with this CLI (no touch); needs a real phone check.
7. After suggesting a trip you land on Answer at the top; the new trip is not necessarily visible (here the "on" trip sorts first).
8. Touch targets under 40px: Suggest/Answer toggle 34, Going/Maybe/Can't 38, tabs 38, crew pill 36, top-right avatar 32, Driving/No car 26, Copy prompt/Paste answer 30, Show on board 35, Windows-tab "Suggest trip" 35 and holiday rows 34, Leave crew about 32, "Any emoji" input 31, "I already have an account" link 16, Join the crew 38.
9. Name field silently stops at 24 characters (typing a 26-character name drops the end); no counter or hint.
10. "Join the crew" and "Copy invite link" (when full) look disabled; the name is the only thing that makes Join live, but nothing says so.
11. Two members can pick the same emoji; with 20 people duplicates are common and avatars no longer identify anyone.
