# Starter art and interface direction

## Common production rules

Source artwork is illustration-only PNG; names, costs, rules, state and owner markers are separate live UI layers. A card's actual definition comes from JSON, never from visual decoration. `assets/manifest.json` records paths, sizes, formats and usage. Source PNGs have opaque paper backgrounds, not alpha cutouts. Use `object-fit: contain` initially to preserve the full illustration; use intentional crop only after checking that the subject survives.

Six new illustrations cover each game's three recognisable starter subjects. Remaining catalogue entries deliberately use labeled SVG fallback symbols, not misleading duplicate creature/machine paintings. Four earlier infographics are historical references; their rules diverge from v0.1 as documented in `DECISIONS.md`.

`assets/ui/tokens.css` is a small editable palette/geometry foundation. `assets/ui/` contains original simple SVG resource symbols, owner tokens and a ready/exhausted marker. Each game also has an editable card frame and card back; Frontier has three schematic terrain tiles. These are working component assets, not finished physical-print production artwork.

## Clockwork Rivals

Warm ivory paper, dark navy text, brass/copper illustration accents. Teal and coral identify players, each paired with a distinct shape and P0/P1 label. Keep machines readable at card scale; avoid heavy decorative borders consuming the effect area. Use small resource animations moving from a machine to the personal reserve; never imply a pipe-transfer rule that does not exist. Highlight orthogonal neighboring cards when previewing a bonus.

Starter paintings: Boiler, Piston, Press. SVG fallbacks: steam for Condenser, coal for Priority Valve/Recycler, work for Flywheel/Hand Crank, gears for Turbine/Precision Press, prestige for commissions. Always show each actual card title prominently so shared fallback imagery does not imply identical effects.

## Living Frontier

Ivory paper, dark forest text, emerald/turquoise habitat colors and restrained meadow gold. Organisms use naturalist watercolor detail. Map tiles stay visually quieter than tokens and influence values. Preserve tile outlines/IDs across terrain changes. Display organism names or short unambiguous labels with player-shape markers; do not rely on painted wildlife as the only indication of occupancy.

Starter paintings: Reeds, Dragonfly, Frog. SVG tiles show terrain; generic growth/influence/movement symbols stand in for unfinished cards. No game claims of biological accuracy are implied.

## Card layout contract

Card frame coordinate system: 630×880, representing a 63×88 mm proportion only. Safe margin 36 units. Title band y=35–105; illustration box x=36,y=125,w=558,h=390; type/cost strip y=530–590; effect area x=44,y=615,w=542,h=215. Frame SVG is a background layer; overlay the art and live text. Do not shrink a complete full-size card into unreadable text: use a condensed board card with an inspect panel on phones.

Resource icons: 128×128 scalable SVG. Terrain tiles: 256×224 flat-top hex silhouette (schematic), with transparent outside. Player 0 uses a circle; Player 1 a diamond, with visible numbers. All SVG art is source-editable; use labels and tooltips in the consuming application.

Use system serif headings and system sans-serif UI initially; no external font dependency is needed. Desktop card-inspection text should be at least 16 CSS pixels; condensed cards can omit full prose and offer a tap-to-read detail. Include reduced-motion and keyboard interaction support.

## Remaining art after the core loop works

Generate dedicated illustrations for the seven unfinished definitions per game, selected commissions, and perhaps one board backdrop. Then check consistency at actual mobile/card scale. Do not commission a full large deck before playtests validate the rules. Print manufacturing needs separate bleed, cut lines, color profile and production proofing; these assets are prototype sources only.

## Provenance

The six new PNG illustrations were generated with the built-in image-generation tool for this package. Exact prompts are in `assets/GENERATION-PROMPTS.md`. No external fonts or third-party art packs are bundled. The resource symbols, frames and schematic tiles were authored as editable SVG for the package. This provenance note is not an exclusivity or trademark-clearance claim.
