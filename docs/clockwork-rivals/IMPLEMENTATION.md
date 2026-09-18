# Clockwork prototype implementation

Current rules are **0.3.0**. See [the iteration record](ITERATION-03.md) for the station redesign. The prepared v0.1 JSON and Living Frontier handoff remain unchanged. Historical v0.1/v0.2 reducers are isolated from the browser/server runtime and retain regression tests.

## Current implementation

- Three stations, one core and two distinct enhancements each. Free private-hand acquisition and separate gear-paid installation. Core replacement preserves enhancements; paid cards recycle and starter cores leave play.
- Six-card age-ordered market, private draw-two choice, hand limit three, oldest-two turnover and separate parts/commission recycling.
- Shared pure production resolver: full-input affordability, fixed station order, switches, refunds, generated versus retained output, caps and conditional-bonus attribution.
- Six commission definitions and six objectives. Both Delivery opportunities finish before an 18-public-prestige race ends; +3 objective bonuses are evaluated before the winner. No round cutoff.
- Explicit per-seat projection. Private entropy, draw/recycle state, hands, blind offers, private discards and objective details are omitted from opponent/spectator/public-report views. Public acquisitions remain observable. Local hotseat uses private screens; browser-memory secrecy is not claimed.
- Blind draw persists as a pending acquisition. Keeping a card and any required hand-limit discard finishes the acquisition; pending choices cannot be cancelled, passed or redrawn. Command deduplication and reconnect preserve the same offers.
- Responsive station table, keyboard controls, compatible installation-slot highlights, cost-deducted previews, production/payment guidance, catalogue, field guide, nine enhancement SVG illustrations, existing machine artwork, optional chime, journal and local notes.
- Colyseus server, seat-bound credentials, invites, revision validation, durable acknowledgements, SQLite, pause/reconnect, 120-second forfeit, mutual rematch and 24-hour room retention.

## Source map

- `packages/clockwork-rules/src/catalogue.ts`: current cores, enhancements, commissions and objectives.
- `packages/clockwork-rules/src/index.ts`: reducer, production resolver, projection, private replay and practice policy.
- `packages/clockwork-rules/src/legacy-v*.ts`: isolated historical implementations.
- `apps/web/src/App.tsx`: workflow, private dialogs, local persistence and room controls.
- `apps/web/src/GamePieces.tsx`: station board, previews and SVG enhancement illustrations.
- `apps/web/src/style.css` and `stations.css`: original visual foundation and responsive station layout.
- `apps/web/src/useRoom.ts`: connection, private credentials and command recovery.
- `apps/server/src/session.ts` and `index.ts`: authoritative sessions, SQLite and hosting.
- `tests/stations.test.ts`: new-rule acceptance, conservation, privacy, complete matches and long replay.
- `scripts/smoke-online.ts`: actual clients and process restarts with a pending blind draw.

## Compatibility and hosting

Rules version 0.3.0 and save format 3 reject older imports clearly. A new browser key preserves earlier autosaves. Complete private backups replay before replacing local state. No fixed action-count limit invalidates a long legal match. Public reports cannot resume games.

One Node process and one SQLite volume are supported for private rooms. GitHub Pages hosts Practice and Pass & play. No accounts, matchmaking, rankings, telemetry or payments were added. The Automaton uses its own projected private information and public state. Human balance/duration, hosted load, Docker execution and physical-device accessibility/browser certification remain unclaimed.
