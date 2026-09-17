# Coding-agent handoff

Copy the following into your coding agent after opening this extracted folder. To start with Living Frontier, change the selected game name and its two file paths.

---

Implement **Clockwork Rivals** from this development kit. The selected baseline is `docs/clockwork-rivals/PLAN.md`, `docs/clockwork-rivals/CARD-CATALOGUE.md` and `data/clockwork-rivals.json`.

Read `README.md`, `docs/DECISIONS.md`, `docs/ENGINE-RECOMMENDATION.md`, `docs/ARCHITECTURE.md`, `docs/ART-DIRECTION.md`, and `contracts/engine-contract.ts` before coding. Both games' exact numerical rules are proposed v0.1 defaults; implement them consistently before balancing. The old posters under `assets/reference/` are visual history, not authoritative rules.

Use React + TypeScript + Vite, browser DOM/CSS cards and SVG boards, with a pure deterministic TypeScript rules module independent of React. Use the provided JSON definitions and art manifest. Install compatible stable dependencies and record actual resolved versions in a lockfile. Do not silently change engines or build a second UI framework.

First create a short task list mapped to C0–C4 in the game plan. Then build C0 and C1: tested rules and a complete local hotseat game, including legal actions, all phases, scoring, reset/new seed, local save/reload and move log. Show exactly which milestone is complete. Do not call an asset gallery a playable prototype. Add representative art without baking rules text into images. Compare the build against the acceptance scenarios in the plan.

After the complete local match works, proceed to the private online milestone using the shared pure rules on an authoritative Node/Colyseus server. Implement server-owned seats, validated commands, expected revisions, duplicate-command handling, reconnect, concede and rematch. An invite URL must not leak the first player's private seat token. Do not implement public matchmaking or ranked progression yet. Test a full match from two clients plus rejection and reconnect cases. Prepare deployment configuration, but do not purchase hosting or publish without the user's instruction.

Keep separate rules modules for the two games. Share interface components and transport contracts only after a real common requirement appears. Implement the selected game first. Keep data/effect definitions explicit, and never interpret card prose with an LLM or `eval` at runtime. Reject illegal actions atomically. Keep balance edits and rules-version changes in `docs/CHANGELOG.md`.

If a rule is truly contradictory, show the exact conflict and offer the smallest resolution. Routine implementation details should not require a permission loop. Never claim test results without running them. Finish with setup/run instructions, checks actually performed and remaining milestones.

---

## Start with Living Frontier instead

Replace the opening instruction with:

> Implement **Living Frontier** first, using `docs/living-frontier/PLAN.md`, `docs/living-frontier/CARD-CATALOGUE.md` and `data/living-frontier.json`. Map the work to F0–F4. Everything else in this handoff still applies.

## Starting on your computer

Extract the ZIP into a new project folder; open it in the editor where your coding agent runs. The kit itself needs no npm install. `preview.html` can be opened directly to view the starter assets.

For implementation, install a supported Node LTS and Git if absent. The agent may scaffold `apps/web` with `npm create vite@latest apps/web -- --template react-ts`, then install dependencies inside that app. This is a future setup instruction, not something already executed in the kit. Before using that command, confirm the target directory is new and preserve the handoff files. Convert to npm workspaces when adding shared rules/server packages; keep one root lockfile at that point. Consult current Vite requirements if Node compatibility warnings appear.

Recommended first agent deliverable: an end-to-end local match. Recommended first human test: play both sides with a friend while noting choices that felt obvious, confusing, or impossible.
