# Living Frontier — implementation plan and v0.1 rules

**Status:** proposed testable design, not validated balance or ecological simulation. **Target:** 2 players, 20–30 minutes, physical portability. **Question:** Can changing a shared habitat make engine-building feel interactive without making players lose the systems they built?

## Experience and differentiator

Draft organisms and adaptations. Organisms produce growth or influence in suitable habitats; supports modify your economy. Change the shared terrain and relocate organisms to contest territory. A new wetland can improve your production while empowering the rival's Frog. Cards remain yours even when they become poorly suited to a tile.

## Components and setup

The authoritative proposed catalogue is `data/living-frontier.json`. Use seven double-sided habitat tiles, organism/owner markers, personal card areas, growth and territory-point tracks. There are ten draft definitions, three copies each, plus each player's three starter cards.

Map axial coordinates (q,r), also supplied in JSON:

| ID | q | r | Starting terrain |
|---|---:|---:|---|
| H0 | 0 | 0 | Wetland |
| H1 | 1 | 0 | Woodland |
| H2 | 1 | -1 | Meadow — P1 home |
| H3 | 0 | -1 | Meadow |
| H4 | -1 | 0 | Woodland |
| H5 | -1 | 1 | Meadow — P0 home |
| H6 | 0 | 1 | Meadow |

Neighbors differ by one of (1,0), (1,-1), (0,-1), (-1,0), (-1,1), (0,1). Homes are entry points, not owned territory and not protected. Start P0's Reeds and Frog on H5 and P1's on H2. Each player also starts with one active Moss support in their personal area, 2 growth and 0 points. No starter card costs growth. Randomly select initiative from the seed, and alternate it each round. Reveal a four-card draft market from the shuffled 30-card deck.

All holdings and terrain are public, including unplanted cards. Future deck order is server-only. Individual cards have unique instance IDs. A player's display holds the actual organism cards plus their associated habitat IDs; small labeled tokens on the map identify their locations. There is no second independent personal habitat map.

## Limits and resources

- At most 6 planted organism instances per player across the map.
- At most 2 of a player's organisms in one habitat; the opponent has a separate 2-organism limit. A habitat can thus hold 4 total.
- At most 2 installed supports per player. Only Moss is a support in this small initial catalogue; duplicate Moss effects never stack.
- At most 5 cards in a player's unplanted reserve. Growth caps at 10; excess gained growth is discarded immediately. Points are uncapped.
- Organisms need not match terrain to exist there. An unsuitable terrain can reduce output/influence to zero but never kills a card.
- Card output/influence is computed from current terrain and friendly organisms; no predation, cascading deaths or ongoing damage.

## Round loop — six rounds

Each action phase starts with initiative; alternate one action, skipping a player who has passed or used the phase allowance. Passing closes that phase for that player. No interrupts. Phase transitions and scoring are automatic logged consequences of the final accepted command.

### 1. Draft — one action each

Choose one of four face-up cards and add it to your public unplanted reserve, refilling immediately. If at reserve limit, identify one reserved card to discard as part of the same draft command. Alternatively pass. The draft deck never reshuffles. If empty, the market shrinks. Drafting an adaptation does not activate it for free.

### 2. Grow — income once, then up to two actions each

At the phase's beginning, both players receive 1 baseline growth plus production from their already-planted producers. Calculate each player's total from the pre-income board, then cap reserves. Growth is never generated again that round; a newly planted producer first earns in the next round.

An action plants one reserved organism by paying its cost, or installs one support. Pay printed growth minus at most one Moss discount; minimum cost 0. Moss can discount one organism planting per player per round, is optional, and is declared with the action. Moss cannot discount installing a support. A newly installed Moss can discount a later planting that round if the per-player discount has not already been used.

An organism may be planted on your fixed home tile, on any tile containing one of your organisms, or any tile adjacent to one of your organisms. Use legal geometry, not territory ownership. Capacity limits apply. If at the global six-organism limit or the destination's two-organism limit, one owned organism may be explicitly removed as part of the planting action, but only if that single removal resolves all exceeded limits. Removed cards are discarded with no refund. Evaluate placement reach before removal, then capacity after removal; this permits replacing the last organism at a valid location. At the support cap, installing a support similarly requires one explicit support replacement. Installing a redundant second Moss is allowed but gives no extra discount.

### 3. Reshape — up to two actions each

Choose one of these, pay its cost, or pass:

- **Basic move:** spend 2 growth to move one of your organisms to one adjacent tile, respecting your per-tile capacity. Movement never removes another organism or changes global count.
- **Play an adaptation:** spend its growth cost and discard it from reserve after resolution. Water Retention changes a Meadow to Wetland; Drainage changes Wetland to Meadow; Dispersal moves one owned organism to an adjacent tile for 1 growth.

A terrain-changing adaptation may target a tile containing one of your organisms or adjacent to one of your organisms. Woodland never changes in v0.1. Neither control nor opponent presence blocks a legal change. A tile may change terrain at most once per round, tracked by a marker. It can change again in a later round. A command that would change terrain to its existing type is illegal. Recompute influence immediately after a move or terrain change for preview; do not award points early. Growth is not recomputed during this phase.

### 4. Contest — automatic simultaneous scoring

For each habitat, sum each player's current influence. The sole player with strictly greater influence and at least 1 influence scores 1 point. Both at zero and all other ties score zero. Control is a derived current condition, not a permanent owner flag. Award all habitat points simultaneously. Round 6 ends the game: most cumulative points wins; equal points is a draw. Do not use stored growth or final territorial control as an unannounced tie-breaker.

Otherwise clear terrain-change and Moss-use markers, flip initiative, advance the round and start Draft. Growth, installed cards, organisms and terrain persist.

## Card vocabulary and example

`CARD-CATALOGUE.md` and JSON contain ten types: Reeds, Dragonfly, Frog, Moss, Water Retention, Dispersal, Clover, Bee, Oak and Drainage. Reeds and Clover generate growth; Dragonfly, Frog, Bee and Oak create influence. Species bonuses check friendly presence on the same tile; one Reeds satisfies every friendly Dragonfly there, but a card never checks an opponent's plant.

Example: your Reeds and Dragonfly share a Meadow. The rival has a Frog there. None supplies influence in a Meadow under these definitions. You pay 2 growth for Water Retention during Reshape: it becomes Wetland. Reeds will generate 2 growth in the *next* Grow phase. Your Dragonfly now has 3 influence (1 base + 2 with friendly Reeds); their Frog has 2. If this remains unchanged until Contest, you score 1 point. Reeds itself supplies no influence. No growth is retroactively credited during Reshape.

## Interface requirements

The shared map is central. Each habitat shows terrain, each player's organism markers, both influence totals and projected point recipient/tie. Selecting a card highlights only legal placement tiles and shows future influence as a preview distinct from the committed totals. Card inspection shows full rules, current contribution and location. Opponent cards remain visible.

Phone layout: map first, expandable reserve and organism tray; touch targets at least 44 CSS pixels with an inspect action before commitment. Use letter/shape owner markers alongside teal/coral. The terrain flip animation must preserve tile ID, organisms and selection. Always show round, phase, active player, action allowance and both scores. No hover-only instructions or drag-only movement.

## Delivery milestones

| Milestone | Build | Exit condition |
|---|---|---|
| F0 — rules | Axial map, placement/movement, income/effects, influence and phase machine | Acceptance scenarios below pass without UI |
| F1 — hotseat | One complete six-round game with previews and log | Humans finish without manually repairing terrain or scores |
| F2 — readability | Starter art, layered markers, explanation of conditional effects | A new tester can explain why a selected tile scores or ties |
| F3 — online | Shared transport adapter, invite rooms and reconnect | Two clients remain synchronized after terrain changes and disconnects |
| F4 — playtests | Balance/control feedback and repeat-match observation | Validate interaction and engine growth before adding species |

## Acceptance scenarios

1. Each hex has exactly its valid axial neighbors; opposite homes have symmetric reach.
2. Income is granted once per round from pre-planting state; new Reeds does not generate immediately.
3. Moss gives at most one optional planting discount and never discounts support installation or adaptations.
4. A third friendly organism cannot be added to a tile without a legal replacement; capacity is not pooled across players.
5. Reach, cost, owner and phase are validated before any resource/card is spent; rejected commands leave state untouched.
6. Reeds + Dragonfly versus Frog becomes 3–2 on Meadow→Wetland; only future income changes.
7. Two Water Retentions cannot reshape the same tile in one round; Woodland cannot be targeted; a fresh round permits a reverse change.
8. Dispersal and basic movement require an adjacent destination and preserve organism count; zero influence does not remove organisms.
9. Ties including 0–0 score nothing; all tiles score once, simultaneously; round 6 ends without extra draft/income.
10. Full reserve drafting and global/per-tile replacement are atomic; removing a card cannot leave an exceeded cap.
11. Seeded setup and accepted-action replay are reproducible; old terrain flags reset at round start; the client cannot submit a score directly.

## Playtest risks and kill conditions

Track match duration, first-player win share, growth unused, board coverage, changed habitats, contested versus uncontested points, and voluntary rematches. Initially test 6–10 paired matches, explicitly exploratory. Ask players to identify a moment where their opponent's terrain decision changed their plan.

Must be true: players can read why each tile scores; developing producers matters before the six-round end; a trailing player can contest without losing all tempo. Watch for early uncontested point leads that cannot be recovered, too many ties, first-seat terrain locks, or a single wetland package always winning. If repeated terrain flips feel arbitrary, reduce adaptation frequency or make upcoming choices more visible. If map play overwhelms combinations, reduce movement efficiency before adding more engine rules.

## Not doing

No real ecological simulation, weather deck, predators consuming opponent cards, procedural maps, hidden objectives, trait stacking on every organism, narrative campaign or large species catalogue. Keep seven stable tiles while testing whether habitat changes are fun.
