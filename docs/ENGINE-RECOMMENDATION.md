# Engine recommendation

Research checked 17 September 2026. This recommendation is an engineering judgment for the confirmed brief, not a benchmark result.

## Decision

Use **React + TypeScript + Vite**, with a small custom TypeScript rules engine. React is a UI library, not a traditional game engine. In these two games that distinction is useful: the hard requirements are turn legality, card readability, state synchronization and fast iteration, not physics or 3D rendering. React owns presentation; a pure rules module owns all game decisions.

| Candidate | Fit here | Trade-off | Decision |
|---|---|---|---|
| React + TypeScript + Vite | Cards, forms, logs, inspectable UI, responsive layouts, SVG map | Board animation and selection behavior must be built explicitly | Recommended baseline |
| Phaser + TypeScript | Dedicated browser 2D framework with scenes, animation, Canvas/WebGL | Text-rich cards and accessible controls need more deliberate UI work | Best traditional game-engine alternative |
| Godot + GDScript | Visual editor and a path to native desktop/mobile builds | Web export introduces browser-specific constraints; server/client rule reuse with a TS backend is less direct | Choose if native delivery or editor-driven workflows become central |

The official Phaser documentation describes browser-first 2D development with JavaScript/TypeScript and Canvas/WebGL. That makes it a credible fallback, not a poor option. [Phaser introduction](https://docs.phaser.io/phaser/getting-started/what-is-phaser)

Godot's stable web-export documentation currently requires WebAssembly and WebGL 2.0, notes that Godot 4 C# projects cannot export to web, and describes single-threaded export as the default. These are manageable constraints, but unnecessary for this card-heavy MVP. [Godot web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)

React provides composable UI components; its documentation includes building from scratch with Vite as an option. Vite supplies development and production tooling and a React-TypeScript template. We do not need server rendering for the initial match screen. [React basics](https://react.dev/learn), [React project choices](https://react.dev/learn/creating-a-react-app), [Vite guide](https://vite.dev/guide/)

## Online layer

Add **Colyseus + Node.js** at milestone 3. Its documented room model and server-authoritative synchronization match two-player sessions. The server validates commands using the same rules package that the local prototype uses; clients never set resource counts or scores. Framework synchronization does not itself make the rules correct. [Colyseus introduction](https://docs.colyseus.io/), [State synchronization](https://docs.colyseus.io/state)

Start with private invite rooms and reconnect support. A room process is not durable storage: add persisted snapshots and accepted-action logs before an external beta. Use a Node host that supports persistent WebSockets; a static web host alone cannot run that server. Provider selection and spend remain open, and no hosting purchase is required to begin.

## Dependency policy

This package does not pretend that an uninstalled dependency set is tested. When scaffolding, choose a currently supported Node LTS compatible with the selected Vite template; check the guide, install mutually compatible stable packages, and commit exact resolutions in a lockfile. Do not independently upgrade a Colyseus client and server across incompatible release lines. Record actual versions in the future repository README. No database is needed for hotseat.

## What would change this recommendation?

- Native-first release with an editor-centric workflow: revisit Godot.
- A board dominated by complex animation, camera effects or hundreds of moving sprites: consider a Phaser board renderer while retaining the pure TS rules.
- Persistent asynchronous games become the primary mode: revisit room lifecycle and durable command handling before adding notifications.

Do not build React, Phaser and Godot versions in parallel. Do not add 3D scenes simply because the pitch art has perspective. Render boards from above, with readable card text and clear legal targets.
