# Clockwork Rivals — implementation plan and v0.1 rules

**Status:** proposed testable design, not validated balance. **Target:** 2 players, 20–30 minutes, browser first and physically playable. **Question:** Can arranging a small machine engine around a contested fuel supply create satisfying combinations and reasons to rematch?

## Experience and differentiator

Draft parts into a personal 3×3 workshop, convert coal into steam, work and gears, and race for shared commissions. Your layout changes selected outputs. Your rival competes for the same parts, coal and orders, but does not dismantle your machines. The pitch is a readable engine-building race with meaningful resource timing.

## Components and setup

Use `data/clockwork-rivals.json` as the corresponding catalogue. Physical kit: two 3×3 mats; six starter cards (a Boiler, Piston and Press for each player); a shared 30-card parts deck (three copies of each of ten definitions); twelve commission cards (four copies of each of three definitions); coal, steam, work, gear and prestige markers; activation/round markers.

1. Randomly choose first player using a server-generated seed; alternate initiative each round. Number rounds from 1 to 8.
2. Give each player a Boiler at (row 1, column 0), Piston at (1,1) and Press at (1,2), using zero-based coordinates. Each starts with 1 coal, no other resources and 0 prestige.
3. Shuffle parts and commissions separately. Reveal four parts and three commissions. All information is public except future deck order. Each physical copy has a unique instance ID.
4. Put exactly 3 coal in the communal supply at the start of each round; unused communal coal returns to the bank before this refill. Personal reserves persist.

## Shared phase/turn procedure

Every phase starts with the current initiative player. Players alternate one action; skip players who have passed or exhausted their phase allowance. Passing is final for that phase, not the round. If both are done, advance automatically. Automatic transitions happen as part of the accepted action and produce log events; clients cannot advance phases themselves. No reactions or interrupts.

### 1. Draft — one action each

Choose one face-up part and install it in an empty workshop slot, for free. If all nine slots are occupied, explicitly choose one card to discard and replace. Refill the market immediately from the deck. A player may instead use their one Draft action to move one owned card into an empty slot or swap two owned cards; or pass. There are no hidden hands or installation costs. If the deck is exhausted, the market shrinks; do not reshuffle discarded cards.

### 2. Power — up to two actions each

On an action, take 1 coal if the shared supply is nonempty. A player owning a Priority Valve may take 1 additional coal in that same action, if available; only one Valve bonus per player per round, even with multiple Valves. It is optional and declared with the action. This action still uses one of the two Power actions. Pass if desired; the phase ends when the supply is empty or both players are done. Personal reserve overflow is discarded automatically as described below.

### 3. Run — up to four actions each

Activate one unexhausted machine, paying its entire input cost from your reserve and gaining its output. Each individual machine instance activates at most once per round. Mark it exhausted. Passive cards and Priority Valve have no Run activation. No affordable unused machine means only Pass is legal. Outputs go into a common personal reserve, not along physical pipe routes. Orthogonal adjacency means sharing a side; diagonals do not count. Adjacency never crosses players' workshops.

All card effects are enumerated in the catalogue. Use the base conversion, then that card's adjacency bonus, then one eligible adjacent Condenser's once-per-round boost when the active card is a Boiler. If more than one eligible Condenser is present, use the one in the lowest row-major slot. Do not trigger other machines automatically. Every Condenser boosts at most once; each Boiler activation gets at most one boost. Apply reserve caps after completing the action.

### 4. Deliver — one action each

Pay the exact gear cost of one face-up commission; gain its prestige and discard that commission. A claimed commission is unavailable immediately. Do not refill commissions until the round ends, so order timing matters. A player may pass. Each player can claim at most one commission per round.

### Round end and victory

After both Delivery opportunities, if either player has at least 10 prestige, or round 8 has ended, finish the game. Highest prestige wins; tied prestige is broken by most unspent gears; if still tied, declare a draw. Never compare a player's account rating or initiative to break a tie. Otherwise refill commissions to three, flip initiative, advance round, ready all cards/reset per-round flags and refill shared coal to exactly three. Empty decks cause smaller rows, not a reshuffle. Resource reserves persist at round boundaries.

Each personal resource (coal, steam, work, gears) has a cap of 8. On gaining resources, discard excess of that same resource immediately. Prestige is uncapped. Bank token availability is abstract/unlimited; a physical prototype can use counters. A winning threshold or round cap changes only through a new rules version, never mid-match.

## Card catalogue and tactical variety

Ten part types and three order types are provided in JSON and `CARD-CATALOGUE.md`. Producers, converters, bypass routes, adjacency support, recycling and a coal tactic create competing investments. The Starter Boiler→Piston→Press chain always works. Extra steam alone is not valuable if no downstream machine can spend it: this bottleneck is deliberate, but must not make half the draft obviously bad.

### Example round

On a fresh round with starter machines and 1 coal, player A installs a Condenser at (0,0), adjacent to their Boiler at (1,0). After taking coal, A activates the Boiler: pay 1 coal, receive 2 steam plus 1 from the Condenser; exhaust both the Boiler activation and Condenser boost. A activates the Piston: pay 1 steam, gain 1 work. A activates the Press: pay 1 work, gain 1 gear. They may use a fourth machine action only if another installed machine is eligible. One gear is not enough for the cheapest order; it carries forward. This example verifies timing, resource persistence and the distinction between artwork and rules.

## Interface requirements

Desktop: market/orders and fuel across top, rival workshop above or beside your workshop, your reserve and clear phase actions nearest you. Phone: compact rival summary, persistent phase/turn header and resource strip, expandable market, own workshop in three readable columns; tap a card for full text. Do not require drag-and-drop. Selecting a machine shows cost, output, affected adjacent cards and final reserve preview. Legal slots/targets are marked by shape and text as well as color. Confirm irreversible draft replacement and deliveries. Ordinary activations need a clear single action, not repetitive dialogs.

Show the four-action Run allowance and exhaustion visually. The log explains accepted moves, phase transitions, overflow loss and scoring. In local hotseat, optionally undo the last move by restoring a recorded state; online has no undo in v0.1. Animations never alter authoritative state.

## Delivery milestones

| Milestone | Build | Exit condition |
|---|---|---|
| C0 — rules | Setup, phase machine, legal commands, all effects, end conditions, replay serialization | Acceptance scenarios below pass without UI |
| C1 — hotseat | Readable full match, card inspection, legal targets, local save/reload, deterministic seed entry | Two people finish a complete match without manual resource corrections |
| C2 — feel | Starter art, short conversion animations, rule explanation and first-round guidance | A new tester understands the next legal action; phone touch works |
| C3 — online | Invite room, server validation, seat reclaim/reconnect, concede and rematch | Two devices finish a match; duplicate/stale commands cannot double-spend |
| C4 — private playtests | Feedback prompt, opt-in metrics, balance revisions | Validate target duration, interaction and rematch intent before public matchmaking |

## Acceptance scenarios

1. Initial setup creates 2 identical starters and different unique instance IDs; same seed reproduces deck order.
2. Piston at 0 work/0 steam cannot activate; rejection does not change state, turn or revision.
3. Boiler then Piston then Press yields the correct deltas, marks instances used and respects the four-activation cap.
4. Diagonal Condenser gives no bonus; two adjacent Condensers do not both boost one activation.
5. Flywheel and Precision Press adjacency bonuses update after a legal swap.
6. Priority Valve cannot take nonexistent coal or grant more than one bonus per player/round.
7. Both players target one commission; only the active seat can claim it, and the next command sees it removed.
8. A player reaching 10 during Delivery does not cancel the other player's Delivery opportunity. Resolve tie rules exactly.
9. Empty market/deck, full grid replacement and capped resources all have defined legal outcomes.
10. Replaying a saved accepted-action sequence reproduces identical state; initiative alternates; round 8 always terminates.

## Playtest and risks

First run 6–10 paired matches with different draft seeds; these are exploration counts, not statistical proof. Log round count, duration excluding disconnects, winner/initiative, drafted and activated cards, coal missed, orders claimed and rematch choice. Ask: which opponent move changed your plan, and when did the outcome feel decided?

Must validate: adjacency changes choices; constrained coal creates planning rather than helplessness; weak draws still allow an alternative route. Warning signs: choosing the same three upgrades every game, too much unused steam, repeated passes, or the trailing player unable to contest orders. Change one balance variable at a time and record the version. Do not add content to cover a dull core loop.

## Not doing

No engine destruction, secret hands, combat system, campaign, power unlocks, crafting hundreds of unique parts, physical pipe-routing simulation or ranked matchmaking in the first slice. Resource-route geometry can be explored later only if simple adjacency is insufficient.
