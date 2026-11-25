# Handoff to Codex: Snow Window illustrations

**Repo:** `~/projects/snow-window` (Vue + Vite). **Your job:** generate three illustrations, save them under `public/art/`, and commit on a branch `codex/art`. Do not touch any other file; Claude wires them into the page afterwards.

## What the site looks like

A public board where friends mark the days they can go skiing, for the 2026–27 season in the Pyrenees, Andorra and Sierra Nevada. The hero is a deep night-blue sky over **flat, layered mountain silhouettes** (two ridge tones, white snowcaps) with an orange sun. The style is flat vector planes, like a 1960s ski-resort poster cut from paper: **no gradients, no glow, no airbrush, no 3D render, no photo-realism, no text**. Shapes are bold and simple, with at most a few flat shadow tones per colour.

## Palette (use only these, plus white)

| Role | Hex |
|---|---|
| Snow | `#f5fbfe` |
| Snow shadow | `#e8f1f8` |
| Ink / outlines (if any) | `#0e2036` |
| Night sky | `#11243e` |
| Far ridge | `#253f5c` |
| Near ridge | `#3a5b7b` |
| Glacier blue | `#1575be` |
| Light glacier | `#90c1e7` |
| Orange (the one hot accent) | `#f96f16` |
| Deep orange | `#b53900` |
| Berry red (sparingly) | `#c02349` |

Orange is the accent: give each character one orange element (sun, scarf, board, goggles) and keep the rest blue, white and ink.

## The three images

All three: **transparent background PNG**, the subject fully inside the frame with ~6% padding, consistent style and line weight across the set, so they look like one series.

1. **`public/art/sun.png`**, 1024 × 1024. The sun that sits behind the mountains in the hero: a flat orange disc (`#f96f16`) with a subtle flat ring or a few chunky rays in deep orange. Calm, poster-like, not a cartoon face. Must read well when shown at 90 px.

2. **`public/art/tycoon-skier.png`**, 1536 × 1536. **An original character**: a portly, cheerful old-money gentleman skiing downhill in a fast, slightly reckless tuck. Top hat, white handlebar moustache, monocle, black tailcoat with tails flying behind him, orange scarf streaming in the wind, wooden skis and poles, a puff of snow spray behind. Funny and dignified at once. **Do not draw the Monopoly mascot ("Mr. Monopoly" / Rich Uncle Pennybags) or anything copied from Hasbro's design**: no cane, no money bag, no Monopoly colours or lettering. It's our own top-hat tycoon. Facing right (the timeline scrolls right).

3. **`public/art/rufus-snowboard.png`**, 1536 × 1536. **Rufus, a small scruffy terrier**, snowboarding: riding sideways on an orange snowboard, ears flapping, wiry coat with a tousled beard, a tiny glacier-blue knitted beanie, mid-carve with a spray of snow, looking delighted. Facing right. *(If Juho gives you a photo of Rufus, match his coat colour and markings; until then use a wheaten/light-grey wiry coat.)*

## Also export

- A 512 px wide copy of each, same name with `@512` (e.g. `tycoon-skier@512.png`), for mobile.
- `public/art/README.md`: one line per file with the prompt you used and the tool/model, so the set can be regenerated.

## Done when

- Six PNGs plus README on branch `codex/art`, transparent backgrounds verified (alpha channel present, no white box).
- Each file under 600 KB (optimise with `pngquant` or similar if needed).
- The three images look like one series in palette and style.

Then tell Juho the branch name; Claude pulls it back and puts the art in the page.
