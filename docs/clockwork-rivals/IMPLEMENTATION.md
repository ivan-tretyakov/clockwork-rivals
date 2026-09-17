# Clockwork prototype implementation

Rules remain version **0.1.0**. The prepared JSON and rules values are unchanged. Living Frontier is excluded.

| Milestone | Delivered |
|---|---|
| C0 — Rules | Pure TypeScript seeded setup, all catalogue effects, atomic validation, phase/action limits, scoring, hidden-deck projection, deterministic replay, versioned saves, acceptance and invariant tests. |
| C1 — Local play | Full hotseat game, legal placement targets, move/swap/full-grid replacement, machine inspection and reserve/adjacency previews, confirmation, journal, autosave/reload, verified import/export, undo, seeded new games and rematches. |
| C2 — Presentation | Responsive ivory/teal/copper table, all ten machine illustrations, three original SVG commission drawings, live resource symbols, phase guidance, catalogue, rulebook, optional chime, count feedback, reduced-motion support, keyboard-native controls and modal focus handling. Practice Automaton included. |
| C3 — Private rooms | Colyseus server, server-bound seats and credentials, invitation links, authoritative validation, revision checks, persistent accepted-command deduplication, SQLite durability, reconnect/pause/120-second forfeit, off-turn concession, mutual rematch, 24-hour retention, rate limits, production build and Docker configuration. |
| C4 — Playtest preparation | Local notes and replay/public-log exports, reproducible import fixture, validation record and Clockwork-only human session guide. Human balance and duration testing remain outstanding. |

## Source map

- `packages/clockwork-rules/src/index.ts`: deterministic rules, projection, replay and practice policy.
- `apps/web/src/App.tsx`: table, actions, inspection, local persistence and dialogs.
- `apps/web/src/useRoom.ts`: private room connection, credentials, command retry and recovery.
- `apps/web/src/style.css`: responsive layout, typography, owner states and reduced motion.
- `apps/server/src/session.ts`: authoritative seat/session state and command acknowledgements.
- `apps/server/src/index.ts`: Colyseus transport, SQLite room retention and static hosting.
- `tests/`: rules/session tests and a replay-verified round-three import fixture.
- `scripts/smoke-online.ts`: two-client WebSocket integration with a real server restart.

## Prototype boundaries

One Node process and one SQLite volume are supported for private rooms. GitHub Pages hosts the public Practice and Pass & play build; its online-room option is disabled unless a room-server endpoint is configured. No account system, public matchmaking, rankings, telemetry or payments were added. The Automaton is a heuristic practice opponent. Hosted load testing, cross-browser/device hardware certification, Docker execution and human balance sessions remain outstanding.

Downloads use a persistent Blob link. A visible, copyable JSON backup is provided for browser shells that intercept file downloads. Imports validate the complete replay before replacing the local table. Online exports contain public state and the journal, never credentials, seeds or unrevealed decks.
