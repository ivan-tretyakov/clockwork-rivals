# Architecture and implementation boundaries

## Rules core

Each game implements the `GameModule` contract in `contracts/engine-contract.ts`. State is serializable plain data. Setup is seed-deterministic, including initiative, deck order and unique instance IDs. Every accepted action increases revision once, including any automatic transitions/scoring it causes. Invalid commands return a structured error and the original state unchanged. Emit events describing effects so the UI never reconstructs them from card prose.

Choose and document one seeded PRNG and shuffle algorithm (for example a versioned xorshift32 + Fisher–Yates implementation, with a nonzero seed normalization). Do not use `Math.random`, current time or React state inside reducers. Persist both the setup seed and accepted actions plus snapshot/rules version. Replays must use the original rules and catalogue version, not the latest balance file.

Use explicitly enumerated effects: conversion, conditional adjacency bonus, once-per-round resource boost, planting discount, terrain-dependent production/influence, terrain change and movement. JSON describes these bounded effects; ordinary typed code evaluates them. Do not build a general card scripting language for v0.1.

## State versus derived values

Persist player resources/points, per-instance locations, exhausted/used flags, active seat, phase, round, initiative, phase action counts, pass flags, market/reserve/deck/discard IDs and configuration version. Frontier also stores tile terrain and changed-this-round flags. Compute legal targets, adjacency, influence totals and territorial control from that state. Do not maintain a second mutable influence cache until performance proves it necessary.

Instance ID and definition ID are distinct. Three copies of one definition must be independently exhausted, moved or discarded. Arrays may represent decks and slots; preserve index semantics and explicit nulls for empty grid positions. Never identify an instance by card title.

## Presentation

React renders a public projection and sends actions through a local/online transport adapter. Keep card inspection, selected targets, tooltips and animations in UI state; keep game resources and turn ownership in the rules. A preview evaluates a copy or pure query and cannot mutate authoritative state.

Desktop and touch use the same action model: select card, select legal target, commit. Make full card text available without hover. Use normal HTML text for cost/effect; icons are paired with words. Keep animation short and skippable under reduced-motion settings. SVG map hit areas must be large enough for touch and have keyboard-selectable alternatives.

Local mode calls the reducer directly and saves a versioned snapshot to browser storage. Online mode displays the latest server projection. Local undo is a state-history feature; online undo is not included. A simple practice bot, if later added, enumerates legal actions and submits through the same path.

## Server and transport

The server owns true state, future deck order, random seeds, seat credentials, connection status and the append-only action log. Only the room process can commit a move. Create a transport adapter around the current Colyseus API, verified against the chosen package versions.

Processing order for each command:

1. Authenticate the connection to its server-assigned seat; ignore any untrusted player ID in payload.
2. Check match ID and rules version. Check whether that seat's command ID was already accepted; an identical duplicate receives its recorded acknowledgement, even if the expected revision is now old. Reuse of the same ID with a different payload is rejected.
3. Check expected revision; a stale new command is rejected with the latest public snapshot/revision.
4. Check match status, active seat, phase, target IDs, ownership, costs and limits using the rules module. Concede is allowed from either seated player while active, even off-turn.
5. Reduce atomically, including automatic phase changes. Persist before publishing success in the external-beta milestone. Serialize room writes to avoid concurrent revision races.
6. Record action/events and broadcast a sanitized new projection. Do not synchronize private deck arrays or future PRNG state.

The UI sends intent, such as `activate` or `play-adaptation`, not an altered state or a claimed score. Never trust a client legal-move list. Hidden future deck order should not appear in the DOM, browser storage or spectator snapshots. Sanitizing a public projection must include nested fields and event payloads.

## Session lifecycle

Private alpha: a creator receives a private seat credential; a separate invite code/link lets a second player claim the empty seat. Once filled, the invite cannot take over that seat. Reconnection requires the original credential; do not put it in the shareable link or log it. Use authenticated server sessions or high-entropy opaque tokens, and transport via HTTPS/WSS when deployed. Rate-limit room creation and commands.

Disconnect: pause game progress and show status. Allow 120 seconds of seat reclaim. After the grace period the connected opponent may claim a forfeit; never allow the disconnected client's browser clock to adjudicate it. If both are disconnected, retain the snapshot and abandon after a documented 24-hour retention period. Reconnect/restart must load the snapshot and accepted revision. Define this server-clock policy as session behavior outside deterministic game rules.

Concede ends the match for the rival. Rematch requires both seats' acceptance, produces a new match ID/seed, resets all game state and swaps first-round initiative relative to the prior match. Setup must support an explicit initiative override for that case. Randomized initial initiative is used for a fresh pairing.

In-memory state is acceptable for localhost development only. Before remote beta, persist snapshots and command acknowledgements so retries after server restart do not duplicate effects. Use a transactional database supported by the selected host; a single-host private alpha can use SQLite with durable disk, whereas ephemeral hosting requires external persistence. Hosting/provider costs remain a later decision.

## Meaningful checks

- Unit-level rule cases from each plan, including costs, topology, limits and termination.
- Property checks over legal sequences: nonnegative reserves; caps; unique live instance locations; monotonically increasing revision; exactly-once scoring; no simultaneous two-seat turn.
- Deterministic replay and save/load with the original rules version.
- Two-client integration: same public state, wrong-seat/stale/duplicate commands, resume after disconnection, concession and rematch reset.
- UI journey: finish a local match, inspect legal targets, keyboard/touch card inspection and a narrow phone viewport.

Do not write tests that simply repeat display strings. Do not consider online ready after only a local UI smoke check.

## Proposed directories

| Directory | Responsibility |
|---|---|
| `apps/web` | React interface, client transport, asset loading |
| `apps/server` | Colyseus rooms, session identity, command serialization, persistence |
| `packages/shared` | Command/result/event contracts and PRNG utilities |
| `packages/clockwork-rules` | Clockwork setup, reducer, legal actions, projections |
| `packages/frontier-rules` | Frontier setup, reducer, legal actions, projections |
| `data` | Versioned card catalogues and default configuration |
| `assets` | Source art and editable component assets |

These are future implementation directories, not claims of existing working code. No need for microservices, a message bus or a generic universal board-game engine.
