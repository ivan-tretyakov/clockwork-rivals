# Decisions, assumptions and unresolved choices

## Confirmed by the user

- Small returning community as success; commercial revenue is not the first goal.
- Two-player competition, 20–30 minute target, combinations with some tactical outsmarting.
- Mostly building with occasional clashes; physical tabletop feasibility preferred.
- Explore Clockwork Rivals and Living Frontier; park Salvage Run, Common Ground and The Final Exhibition.
- Produce two development plans, research the engine, generate assets and hand off one package.

## Proposed here, not yet playtested

| Topic | Default | Why |
|---|---|---|
| Initial platform | Desktop and mobile browsers, touch/click | A link is sufficient to join a playtest |
| First implementation | Clockwork Rivals | Smaller interaction model and a straightforward resource loop |
| Second implementation | Living Frontier on the same technical foundation | Compare games after basic UI/session infrastructure exists |
| Accounts | Guest invite rooms first | Avoid account friction during private testing |
| Information | All drafted and owned cards public; future deck order server-only | Prioritize combos and prediction over memory/hidden hands |
| UI | Flat cards/boards with selective motion | Physical rules remain visible |
| Exact balance | Versioned v0.1 numbers | Build a reproducible first experiment, then change deliberately |

## Changes from the pitch images

- Clockwork checks the 10-prestige threshold at round end, rather than ending mid-delivery. Both players receive their delivery opportunity. Round 8 is a hard endpoint.
- Clockwork has an explicit 3×3 workshop, adjacency effects, four machine activations per round and fixed reserve caps. A Condenser now requires orthogonal adjacency to the Boiler it boosts.
- Clockwork's three starter machines ensure nobody waits for a missing basic card. Gear output, not merely extra steam, must improve as engines grow.
- Living Frontier uses personal card records linked to organisms on a shared seven-hex map. Cards belong to players; habitat terrain is shared and control is recalculated, not permanently owned.
- Dragonfly receives 1 wetland influence plus 2 more with friendly Reeds. The poster's Dragonfly and Frog both giving 2 made the conditional card unattractive before any costs were specified. The old poster's 2–2 example is historical, not v0.1.
- Growth, planting costs, action budgets, placement reach, habitat changes and replacement rules are now explicit.
- A rules engine computes effects. Decorative resource marks and wording in old posters must not be parsed into game behavior.

## Still open; none blocks the first prototype

- Which game Ivan ultimately wants to pursue, and preferred visual tone after trying the loops.
- Actual match length, first-player advantage and repeat-play appeal.
- Public matchmaking, async mode, ranked play, bot strength and monetization.
- Hosting provider, domain, operating budget and eventual physical production.

## Focus boundaries

No campaign, unlockable power advantage, collectible purchases, native builds, 3D, more than two players or AI-generated runtime rules in the first prototype. A small local practice bot can follow after hotseat; it must use the same legal action interface. Do not train a model to play before humans find the game worth replaying.
