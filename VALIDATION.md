# Clockwork Rivals validation

Checked locally on 17 September 2026. Rules version 0.1.0. Living Frontier remains unimplemented and unchanged.

## Automated checks

- `npm test`: **24 tests passed** across rules and authoritative-session suites. Includes all ten brief acceptance scenarios, all ten machine effects, full-board replacement, no reshuffle, exact payment, overflow, alternating initiative, both Delivery opportunities at the winning threshold, gear tie-break/draw, off-turn concession and the eight-round limit.
- Forty seeded complete simulated matches terminate, preserve resource and unique-instance invariants, increment accepted revisions once, and replay deterministically. Corrupted saves are rejected.
- The checked-in round-three fixture loads by replay at revision 30.
- Private-session checks cover seat-bound credentials, safe invites, hidden-deck projection, wrong-turn/malformed/stale/version/match rejection, duplicate-before-revision ordering, changed-payload command-ID reuse, pause, reconnect, forfeit timing, mutual rematch and rollback on persistence failure.
- `npm run build`: strict TypeScript check, Vite production browser bundle and bundled Node server succeed.
- `npm run test:online`: two actual Colyseus clients pass invite/seat binding, projection, duplicate/stale rejection, disconnect pause, credential reconnect, **actual process restart with the same room/state/accepted acknowledgement restored**, complete match, mutual rematch and off-turn concession. Observed match: round 7, 98 accepted moves, P0 winner. The test uses its own port 2577 and SQLite directory.
- `python scripts/validate_package.py`: **37 manifest assets**, 13 generated illustrations, 19 editable SVGs; source sizes, SHA-256 digests, PNG CRC/dimensions, both original catalogues, links and original offline preview pass.
- npm installation audit reported zero vulnerabilities at implementation time; package-lock.json is included.

## Browser and visual checks

The actual application was operated through the Codex in-app browser, with desktop and phone viewport checks. Screenshots were inspected directly. These checks establish operation, not strategic balance.

- Desktop table at the default approximately 1065px viewport and an explicit 1440px viewport: header, phase track, four-part market, commissions, fuel, both grids, inspector, journal, score and results.
- Phone viewport 390×844: three grid columns, no horizontal document overflow, sticky phase/resource bars, full inspection, action button, collapsed rival summary, new-game dialog, full-grid replacement confirmation and catalogue. All ten catalogue images loaded.
- All ten machine illustrations inspected together in the desktop catalogue: distinct subjects, complete machines, consistent brass/copper/ivory styling. Names and rules remain live text.
- Complete hotseat game through UI buttons, seed 1847: Teal won **10–8 in round 6** after both Delivery opportunities. Drafting, fuel, activations, Condenser adjacency bonus, passing and delivery worked throughout. Cancelling delivery left two gears and prestige unchanged; confirming spent the exact cost.
- Rearranged Copper's Boiler, then used Undo to restore its original slot and phase. Reload restored the finished 10–8 result exactly.
- A second game on the mobile layout filled all nine slots. Round-seven replacement required confirmation and replaced the selected Condenser with Hand Crank. Passing thereafter produced the correct **round-eight draw**.
- Two browser origins (`localhost` and `127.0.0.1`, isolating seat storage) joined one private room as Teal and Copper. Flywheel and Hand Crank drafting and coal synchronized. Reload reclaimed Copper's seat. Leaving disabled Teal's moves and showed the pause message; revisiting the invite restored the seat. Off-turn concession and mutual rematch synchronized and alternated initial initiative.
- Imported `tests/fixtures/round-three.json` through the file chooser: round 3, revision 30, replay verified. Export preview and clipboard backup contained format 1, the same state and all 30 actions. The in-app browser did not expose a download-completion event; a persistent download link and copyable fallback are provided.
- Keyboard Enter opened the field guide; Escape closed it. Native dialog focus behavior is used.
- Production browser build at port 2567: a complete Practice match finished in round 6 with the Automaton scoring 12 prestige while the human seat passed. Bot actions, automatic phase transitions and victory worked without intervention. Fresh production browser logs contained **no errors or warnings**.
- Development hot reload initially remounted the React root. Separating the entry point from App fixed that issue before the production check.

## Limits of this validation

No hosted multiplayer latency/load test, Docker runtime test, physical-device browser matrix, screen-reader certification, or human balance/duration test is claimed. The 20–30 minute target and willingness to rematch need paired human sessions. See `docs/clockwork-rivals/PLAYTEST.md`.

The original preparation package's integrity checks remain supported. Its offline preview is an asset catalogue; use `npm run dev` or the production build for gameplay.

## First playtest feedback: ending Run

- Replaced ambiguous “Pass run” with “Finish running” when no legal activation remains, and “Finish running early” while machines are still usable.
- The inspector shows a prominent completion prompt, explains exhausted machines versus insufficient resources, identifies Delivery as the next phase, and clarifies waiting for the rival. The turn bar stops advertising unused action allowance when there is nothing to activate.
- Verified the exhausted-starter scenario using a legal nine-action replay on the exact Pages build. Desktop and 390px mobile screenshots show the completion prompt. Clicking Finish running advances to Delivery and preserves coal 2, steam 1, work 0 and gears 1.
- Pages build succeeds under `/clockwork-rivals/` with all machine and resource artwork loaded. Local and online server builds retain their existing root paths. The public static build exposes Practice and Pass & play.
- All 24 existing rules/session tests still pass; this feedback change does not alter game rules or replay format.

## Public deployment

- Published source to `ivan-tretyakov/clockwork-rivals` on GitHub and the static build to the `gh-pages` branch. GitHub reports a successful Pages build with HTTPS enforced.
- Opened https://ivan-tretyakov.github.io/clockwork-rivals/ in a fresh browser tab and visually checked the table and mode picker. Practice and Pass & play are available; the online-room limitation is explained in the picker.
- Imported the exhausted-starter replay on the public site, visually confirmed the Finish running prompt beside the machines, then clicked it and verified Delivery began. All displayed images loaded, the desktop document had no horizontal overflow, and the fresh public tab reported no console errors or warnings.
- Started a fresh Practice game after the live check. Multiplayer remains available through the supplied Node server, not GitHub Pages.
