# Clockwork Rivals · playtest iteration 0.2

Implemented on 17 September 2026 from the locally supplied assessment. The assessment itself remains in the ignored `.local` directory. The visual identity, starter Boiler/Piston/Press engine, universal grid slots and original preparation assets are preserved. Living Frontier is unchanged.

## Separable changes

1. **Production control.** Each player has a persistent ordered list of active machines. New active machines append enabled; removed machines disappear. Toggles and arrow/drag controls are free before production. The pure resolver scans enabled entries in priority order, executes the first affordable unused machine and rescans. A machine runs at most once. The same resolver supplies the preview and authoritative result. Preview lists actual conversions, final reserves, overflow and skip reasons. A single Run planned machines action finishes the player's production; a skip action preserves resources. The four-activation path exists only in the isolated historical v0.1 reducer.
2. **Private objectives.** Default: privately choose one of two distinct candidates; four candidates are dealt without replacement from an independently shuffled six-card deck. Public machines and commissions can be inspected first. Both selections must lock before Draft. Random-one and objectives-off are comparison options. Exactly one objective can be active. The six candidate conditions from the assessment are implemented, including capped output, net gear gain, distinct activated/commission definitions, two separate zero-coal Power rounds, and reserve evaluation after final Delivery.
3. **Scoring and information boundaries.** Objectives add the configured bonus (+2 by default) once at normal match end. They never trigger the end. Final scores are computed before the winner is emitted: public prestige + objective bonus, then gears, then draw. Concession awards the rival the match and does not grant bonuses. Only selected objectives reveal; unused offers never appear in public views. Crypto-generated private deals are independent of the public deal seed. Per-seat server projections, private durable records, public log/report redaction and reconnect retention are tested. Bots are given only their own projected card and public state. Hotseat uses handoff screens and an explicit private-card view.
4. **Installation preview.** Selecting a market part and destination opens a review before committing. The proposed grid marks the new part and relevant neighbors. Active/inactive adjacency, before/after execution, reserve changes, idle machines and cap waste use the current reserves and saved plan. The estimate warns that future Power actions can change the outcome. Replacement uses the same review and names the discarded part.
5. **Mixed commissions.** Existing commissions keep their original gear recipes. Steamworks costs **3 steam + 1 gear → 3 prestige**; Automated Foundry costs **2 work + 1 gear → 3 prestige**. Three copies of each join the mixed deck. Classic gear-only mode remains selectable. Payments validate all costs before spending any resource. Delivery shows every cost and shortage; bots understand the mixed costs and their own objective. Prices and rewards are experimental, not established balance.

## Configuration and pacing

New game → Playtest rules exposes objective distribution, mixed/classic commissions, public prestige target, round limit, shared coal and objective bonus. Default public target **10**, round cap **8**, coal supply **3**, objective bonus **2**. No fuel or pacing rebalance was inferred from the previous bot sample.

Private authoritative metrics retain capped resource outputs, successful machine types, best whole-production gear gain, coal taken by round and independent qualifying rounds. Public playtest reports omit private metrics/cards. Notes are saved locally, not sent to a telemetry service.

Human follow-up should compare one change at a time. Record the first useful combination, subsequent times it ran, actual fuel shortages, cap waste, plan edits and why they were made, match duration and willingness to rematch. Ask which decision the objective changed. Separate offer/choice/completion frequency from win rate and account for player experience. Automated games establish termination and consistency, not human duration, strategic quality or balance.

## Compatibility

- Rules version 0.2.0 and save format 2 explicitly reject v0.1 imports with an explanation. Old browser autosaves are preserved under their original storage key. New matches use `clockwork-local-v2`.
- Complete private saves include the private objective deal and replay actions. Browser autosave and server persistence use that format. The downloadable public report is deliberately not a resumable private save. Import accepts complete v0.2 private backups for recovery or controlled fixtures.
- Earlier room records are retained but are not restored as v0.2 rooms. Players create a new room. Rematches retain configuration, alternate initiative and deal fresh private cards.
- Online rooms still need the supplied Node server; GitHub Pages hosts Practice and Pass & play.

## Validation

The new rules tests cover the assessment's production examples, objective metrics, selection lock, both distribution modes, final-score reversals/ties/concession, privacy projections and exports, reconnect, atomic mixed payments, placement previews and explicit old-save rejection. Thirty additional complete v0.2 simulated matches alternate distribution and commission settings and verify full private replay. The historical reducer keeps its original regression tests.

See [VALIDATION.md](../../VALIDATION.md) for the current automated and browser evidence. Cross-device hardware coverage, formal accessibility certification, hosted multiplayer load and paired human balance/duration sessions remain unclaimed.
