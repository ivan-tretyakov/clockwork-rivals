# Clockwork Rivals — playable prototype

Clockwork Rivals uses playtest rules **0.3.0**, implementing the confirmed station redesign. Play against the Automaton, pass the screen between two people, or use the supplied private-room server. Living Frontier remains unchanged.

## Public playtest

Play at **https://ivan-tretyakov.github.io/clockwork-rivals/**. GitHub Pages supports Practice and Pass & play, autosave, private objectives, public reports and rematches. Private online rooms require the Node server below.

Your workshop has three columns: **Energy → Conversion → Fabrication**. Each station has one replaceable core and two compatible enhancement slots. Both players start with a working chain, one coal and **3 gears**.

The round is **Acquire → Install → Power → Produce → Delivery**:

- **Acquire:** take one of six face-up parts, or draw two privately and keep one. Acquisition is free; the part enters your private hand. Discard down to three immediately.
- **Install:** optionally pay gears to install one hand card in its station. Replacing a core preserves enhancements. Replaced cards give no refund. Review the destination, cost and production estimate before committing.
- **Power:** alternate taking one coal, up to twice per player, from the shared supply of three.
- **Produce:** switch stations on or off, review the exact result, then click **Run all enabled stations**. They operate once in order; settings persist. Full input is required before refunds.
- **Delivery:** pay every resource listed on one commission, or keep reserves. The display refills only after both opportunities.

At a continuing round's end, the oldest two remaining parts rotate out. Parts and commissions recycle their own discards. The 30-part deck contains six replacement cores and nine enhancements, two copies each. Six commission definitions have three copies each.

Choose one of two **private objectives** before the markets open. Default race target: **18 public prestige**, plus **3 final prestige** for a completed objective. Finish only after both Delivery opportunities; compare final prestige, then unspent gears, then draw. **There is no round cutoff.** A private bonus can change the winner. Eight to ten rounds and 20–30 minutes remain playtest goals.

**New game → Playtest values** adjusts the public target, objective bonus and shared coal. Card values are provisional. See [iteration 0.3](docs/clockwork-rivals/ITERATION-03.md) and [the current catalogue](packages/clockwork-rules/src/catalogue.ts).

**Privacy:** online views contain only the owner's hand, objective and pending blind choices. Other viewers receive public state and hand counts. Blind draws persist before selection, so reconnect cannot redraw. Public reports exclude hidden cards and cannot restore a game. Local autosaves and server records retain the private replay.

**Version boundary:** earlier 0.1/0.2 saves and rooms cannot be reinterpreted under 0.3. Old browser-storage keys and room records remain preserved. New matches use `clockwork-local-v3`. Rules, catalogue hash, private save format and network validation are versioned together. Historical reducers retain their regression tests.

## Run the game

Use **Node.js 24 LTS** (tested here with Node 25.9) and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. The browser app runs on port 5173 and the room server on 2567. Choose **New game** for Practice, Pass & play, or Private online room. A practice game starts immediately on first visit. The Automaton is a simple heuristic practice opponent.

Acquire a part, open your private hand to install it, collect fuel, run the enabled stations, then choose a commission or keep reserves. Players alternate turns and phases advance automatically. The field guide and catalogue explain all cards.

Local games autosave with a verified private action replay. The Game menu provides a redacted public-report export, private-backup import, sound, and concession. Private choices are committed; cancel before confirming acquisition, installation or delivery. Online tables use private reconnect credentials stored in the original browser. Share the invite with a different browser/device; the same browser profile retains its own seat.

## Validate and build

```sh
npm test
npm run build
npm run test:online
npm start
```

The production app and WebSocket server share **http://localhost:2567**. `test:online` starts an isolated server on 2577 and checks two clients, idempotency, reconnect, actual process restarts including a pending private blind draw, a complete match, rematch, and concession. See [validation evidence](VALIDATION.md).

The original source PNGs are preserved. `npm run assets` regenerates optimized WebP artwork in the browser's public directory. All assets and fonts are local; there is no tracking or account system.

## Private hosting

A Dockerfile builds and serves the app. Mount a persistent volume at `/data`, expose port 2567 through an HTTPS/WebSocket-capable reverse proxy, and set `ALLOWED_ORIGIN` to the browser origin. Single process / single replica is the supported prototype topology. SQLite stores room state and accepted command acknowledgements before a move is acknowledged. Rooms are retained for 24 hours after last activity. A claimed disconnected rival gets 120 seconds to reconnect before a forfeit can be claimed.

For development on a second device, both local ports must be reachable; `localhost` in an invite is only usable on the same computer. A hosted HTTPS room server is needed for remote online play. Docker configuration is supplied; the actual production Node build was tested locally, not in Docker.

## Publish to GitHub Pages

Source lives on `main`; the compiled static site lives on `gh-pages`. After committing and pushing source changes, run:

```sh
npm run deploy:pages
```

This builds with the `/clockwork-rivals/` base path and pushes the compiled files using a temporary Git index. It preserves the source working tree and the deployment branch's history. Configure GitHub Pages to publish from the root of `gh-pages`. Preview the same artifact locally with `npm run build:pages` then `npm run preview:pages`.

`VITE_ROOM_SERVER` can enable online rooms in a future Pages build once an HTTPS/WebSocket server is deployed. Do not put private credentials in Vite environment variables; they are bundled into the public client.

The game mechanics are functional; balance, the 20–30 minute target, and human replay appeal remain to be tested. Download local **Playtest notes** and the public report after a session. The original catalogue remains preserved; the station catalogue is separate under rules 0.3.0.

---

# Original boardgames development handoff

Prepared for Ivan Tretyakov · 17 September 2026 · Design version 0.1.0

The sections below describe the original preparation package. Clockwork implementation status is recorded above; the original plans and Living Frontier remain available as references.

## Start here

1. Open `preview.html` to browse the starter artwork and example cards locally. No installation needed; this is an asset catalogue, not gameplay.
2. Read `docs/ENGINE-RECOMMENDATION.md` and the selected game's `PLAN.md`.
3. Give a coding agent this folder and `AGENT-START.md`. It defaults to Clockwork Rivals first; change the named game to start with Living Frontier.
4. The agent should implement the selected rules module and local hotseat prototype, then add private online rooms. Build the second game after the first has a usable rules/test foundation.

## Recommended stack

React + TypeScript + Vite for the browser interface; a separate, deterministic TypeScript rules engine for each game; Colyseus + Node.js for the online milestone. Use HTML/CSS for cards and SVG for the habitat map. Phaser is the preferred alternative if rich animated board scenes become essential. Godot remains viable for a later native-first direction.

## What is included

- Two detailed prototype plans: complete default rules, implementation milestones, acceptance scenarios, risks and playtest gates.
- Engine research with primary-source links, architecture and online synchronization requirements.
- Machine-readable card catalogues, board/setup configuration and asset manifest.
- TypeScript interface contracts (not a rules implementation).
- Original generated card illustrations, editable SVG component art and CSS design tokens.
- Earlier pitch infographics, kept only as historical visual references.
- Asset catalogue, validation script, and copy-paste coding-agent instructions.

## Authority and assumptions

The user confirmed: two players, 20–30 minute target, combinations first and tactical interaction second, mostly building with occasional clashes, physical playability preferred, browser launch first, and success measured by a small returning community.

All exact cards, quantities, phase limits and scoring rules here are **proposed v0.1 defaults**. They have not been approved individually or playtested. Read `docs/DECISIONS.md` for changes from the illustrations. Written plans and JSON are the implementation baseline; reference posters are not rulebooks. If prose and data disagree, report and reconcile before implementing that rule.

The prototype now has a source repository, a public static playtest, and a locally runnable private-room server. No accounts, tracking, payments or public matchmaking were added. Rules text is rendered by the interface, never baked into the illustrations.

## Verify this package

With Python 3 available, from this folder run `python scripts/validate_package.py` (or `python3` on systems that use that name). It verifies data and packaged assets, not game balance. See `VALIDATION.md` for checks performed during preparation.

## Suggested future repository layout

`apps/web/`, `apps/server/`, `packages/shared/`, `packages/clockwork-rules/`, `packages/frontier-rules/`, plus these `docs/`, `data/`, and `assets/` directories. Do not install dependencies or scaffold a new app inside the data folders. Keep original source PNGs; derive web-optimized variants during implementation.
