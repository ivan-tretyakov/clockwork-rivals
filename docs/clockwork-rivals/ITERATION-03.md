# Clockwork Rivals · station redesign 0.3

Implemented from the revised private design handoff on 18 September 2026. The handoff itself and private QA fixtures remain in ignored `.local`. This release is 0.3.0 because the earlier activation-list iteration already shipped as 0.2.0. Living Frontier is unchanged.

## Rules delivered

| Area | Rules 0.3 |
| --- | --- |
| Workshop | Energy → Conversion → Fabrication. Each has one core and two station-compatible enhancements. Positions within a station are equivalent. |
| Start | Basic Boiler, Basic Piston, Basic Press; 1 coal and 3 gears. |
| Acquire | Take one of six displayed parts, or privately draw two and keep one. Free acquisition into a hand of at most three; required discard is atomic with the keep. |
| Install | At most one hand card, paying its gear price. Core replacement preserves enhancements. No refunds; duplicate enhancement definitions cannot share a station. |
| Power | Shared coal resets to 3. Alternate one-coal takes, at most two per player, without exceeding the cap. |
| Produce | Switch stations independently; commit one fixed-order production. Full input before refunds. Skipped stations do not trigger enhancements. Later stations may use saved reserves. |
| Delivery | One shared commission, atomic full payment. Removal is immediate; refill waits until both opportunities finish. |
| Continuing round | Refill commissions, rotate the two oldest remaining parts, refill, swap initiative, reset fuel and operations. |
| Recycling | Parts and commissions recycle their own piles. Replaced starter cores leave play. Never borrow from hands/workshops or create extra cards. |
| End | Public target 18, after both Delivery opportunities. Reveal selected objectives; add 0 or 3; compare final prestige, then unspent gears, then draw. No round cutoff. Concession fixes the rival as winner and grants no bonuses. |

The complete catalogue is [catalogue.ts](../../packages/clockwork-rules/src/catalogue.ts): three starters, six replacement cores × two, nine enhancements × two, six commission definitions × three, and six distinct objectives. Original data/catalogues remain historical references. Reused names have the new recipes, including Precision Press, Steam Turbine, Flywheel and Observatory.

## Production and previews

A pure resolver returns each station's input, generated primary output, retained output, actual input refunds, overflow, bonuses and skip explanation. Both preview and committed production call it. There is no queue, backward rescan, adjacency or independent enhancement activation.

Synchronizer and Batch Die reference upstream generated output before storage caps. Synchronized Workshop instead requires a retained conditional benefit. Capacity attribution is base output, unconditional additions, then conditional additions. Multiple qualifying triggers in one production count once.

Installation previews deduct the gear price before simulating. They show the proposed station/slot, retained attachments, replacement with no refund, current reserves after payment, outcome without investment, and proposed production with cap waste and conditional explanations. Future Power changes are explicitly excluded from that estimate.

## Private information and durable choices

Objectives are choose-one-of-two only. Four distinct offers are privately dealt before the markets open. Each selected objective locks for the match. Player-facing reports never reveal unused offers.

Separate private 256-bit HMAC-SHA-256 counter streams for parts, commissions and objectives are seeded from host crypto entropy, independent of the public match identifier. Private setup and evolving shuffle state are retained only in authoritative persistence. The HMAC implementation comes from the pinned @noble/hashes dependency. Counter output supports deterministic replay without exposing a reversible PRNG state through card identifiers. This does not protect against access to the host's memory.

Per-viewer projections explicitly whitelist public fields. Owners additionally receive their own hand, objective/progress and pending blind offers. Opponents and spectators receive hand counts; private draw/discard card IDs, seeds and full actions are omitted. Face-up acquisitions and installed cards remain public information. Exports redact private owner fields too. Only selected objectives reveal at the end; hands and unused offers remain private.

Starting a blind draw is a durable internal step of acquisition. It does not advance the turn or allow pass/cancel/redraw. The owner must keep one of those offered instances and, if needed, choose one discard from the resulting hand. The public hand never exceeds three. Reload, reconnect and server restart retain the same pending choice. Duplicate command acknowledgements are checked before stale revision rejection.

Hotseat gates each change of player with a handoff. Private hand/objective/draw dialogs are removed from the DOM at handoff or when hidden. Local memory and complete autosaves necessarily contain both players' information; online server projection is the enforcement boundary.

## Version and interface

Rules 0.3.0, private save format 3, a new catalogue hash and `clockwork-local-v3` separate the redesign from old games. Imports reject older versions clearly; old autosave keys and room records remain preserved. Long legal matches have no 1,000-action replay cutoff. Public reports are not private backups.

The station table preserves the ivory/teal/copper visual identity and machine illustrations. Nine SVG enhancement illustrations live in the UI source. Five guided phase panels explain the next action, with payment confirmation and automatic transitions. The hand remains behind an explicit private inspection control. The field guide and catalogue describe current rules.

Practice uses a heuristic that sees only the bot's private projection and public state. It evaluates investment, station switches, commission affordability/progress and its own objective. This is a functional opponent, not an optimal-play or balance model.

New game exposes the public target, objective bonus and coal supply as playtest values. No random-assignment, no-objective, old-commission or fixed-round alternate modes remain in this rules version. No economic tuning was inferred from automated tests.

## Validation and next human gate

See [VALIDATION.md](../../VALIDATION.md) for current automated, online and visual evidence. The worked eight-round investment trace is tested separately with its stated availability assumptions; real games retain the actual market, deck and private-hand rules.

Before expanding the catalogue, conduct repeated two-player sessions using [PLAYTEST.md](PLAYTEST.md). Record finishing time/round, first useful return, combination reuse, investment versus delivery choices, specialist commission availability, objective decisions, shortages and rematch interest. Human balance, the desired development window and 20–30 minute duration remain unverified.
