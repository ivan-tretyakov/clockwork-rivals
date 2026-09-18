import { describe, it, expect } from "vitest";
import {
  VERSION,
  PARTS,
  ORDERS,
  STATIONS,
  setup,
  reduce,
  project,
  publicReport,
  productionPlan,
  installationPreview,
  legalActions,
  chooseBotAction,
  saveGame,
  loadGame,
  objectiveProgress,
  type State,
  type Action,
  type Seat,
  type AcceptedAction,
} from "../packages/clockwork-rules/src/index";
const fresh = () =>
  setup({
    seed: 17,
    rulesVersion: VERSION,
    initiativeOverride: "P0",
    privateSetup: {
      entropy: Array.from({ length: 24 }, (_, i) => (i + 1) * 7919),
    },
  });
function go(s: State, action: Action, actor: Seat = s.activePlayer!) {
  const r = reduce(s, actor, action);
  if (!r.ok) throw new Error(r.message + " " + JSON.stringify(action));
  return r.state;
}
function ready() {
  let s = fresh();
  s = go(s, { type: "choose-objective", objective: s.offers.P0[0] });
  return go(s, { type: "choose-objective", objective: s.offers.P1[0] });
}
function phase(phase: State["phase"]) {
  const s = ready();
  s.phase = phase;
  s.activePlayer = "P0";
  return s;
}
function fit(s: State, id: string, slot = 0) {
  const d = PARTS[id],
    st = s.players.P0.stations[d.station],
    c = { id: "fixture-" + id, definitionId: id };
  if (d.kind === "core") st.core = c;
  else st.enhancements[slot] = c;
}
function cardCount(s: State) {
  return [
    ...s.partDeck,
    ...s.partDiscard,
    ...s.market,
    ...(s.pendingAcquisition?.offers ?? []),
    ...(["P0", "P1"] as Seat[]).flatMap((seat) => [
      ...s.players[seat].hand,
      ...STATIONS.flatMap((st) => [
        s.players[seat].stations[st].core,
        ...s.players[seat].stations[st].enhancements.filter((c) => !!c),
      ]),
    ]),
  ].filter((c) => !PARTS[c.definitionId].starter);
}
describe("Station rules 0.3", () => {
  it("the practice bot preserves work toward mixed commissions instead of endlessly producing unsellable gears", () => {
    const s = phase("run");
    s.orders = [{ id: "factory", definitionId: "factory-automata" }];
    const a = chooseBotAction(s);
    expect(a.type).toBe("set-stations");
    if (a.type === "set-stations") expect(a.enabled[2]).toBe(false);
  });
  it("tracks actual replacement operations and at most one retained conditional objective benefit per production", () => {
    let s = phase("run");
    fit(s, "industrial-boiler");
    fit(s, "heat-recovery");
    fit(s, "synchronizer");
    fit(s, "batch-die");
    s.players.P0.resources.coal = 2;
    s = go(s, { type: "produce" });
    expect(s.objectivesPrivate.P0.metrics.modernized).toEqual(["energy"]);
    expect(s.objectivesPrivate.P0.metrics.synchronizedRounds).toEqual([1]);
    expect(s.players.P0.resources.gears).toBe(6);
  });
  it("the bot cannot use an opponent objective, hand or rejected blind card to choose its move", () => {
    const s = ready(),
      before = chooseBotAction(s),
      changed = structuredClone(s);
    changed.objectivesPrivate.P1.selected = "modernizer";
    changed.players.P1.hand = [
      { id: "secret-card", definitionId: "gear-cutter" },
    ];
    changed.partDiscard = [
      { id: "secret-discard", definitionId: "synchronizer" },
    ];
    expect(chooseBotAction(changed)).toEqual(before);
  });
  it("hides markets until four distinct private offers have produced two locked choices", () => {
    let s = fresh();
    expect(s.market).toHaveLength(0);
    expect(s.partDeck).toHaveLength(30);
    expect(s.orderDeck).toHaveLength(18);
    expect(new Set([...s.offers.P0, ...s.offers.P1]).size).toBe(4);
    expect(reduce(s, "P0", { type: "pass" }).ok).toBe(false);
    s = go(s, { type: "choose-objective", objective: s.offers.P0[0] });
    expect(s.market).toHaveLength(0);
    expect(
      reduce(s, "P0", { type: "choose-objective", objective: s.offers.P0[1] })
        .ok,
    ).toBe(false);
    s = go(s, { type: "choose-objective", objective: s.offers.P1[0] });
    expect(s.market).toHaveLength(6);
    expect(s.orders).toHaveLength(3);
    expect(s.players.P0.resources.gears).toBe(3);
  });
  it("keeps private deals independent of public identifiers", () => {
    const a = setup({ seed: 17, rulesVersion: VERSION }),
      b = setup({ seed: 17, rulesVersion: VERSION });
    expect(a.privateSetup).not.toEqual(b.privateSetup);
    expect(a.partDeck).not.toEqual(b.partDeck);
  });
  it("acquires without installation or payment, preserves market age, and refills immediately", () => {
    const s = ready(),
      old = s.market.map((c) => c.id),
      replacement = s.partDeck[0];
    const n = go(s, { type: "acquire-market", instance: old[2] });
    expect(n.players.P0.hand[0].id).toBe(old[2]);
    expect(n.players.P0.resources.gears).toBe(3);
    expect(n.players.P0.stations).toEqual(s.players.P0.stations);
    expect(n.market.map((c) => c.id)).toEqual([
      ...old.filter((_, i) => i !== 2),
      replacement.id,
    ]);
    expect(n.activePlayer).toBe("P1");
  });
  it("resolves overflowing hands atomically, allowing the newly acquired card to be discarded", () => {
    const s = ready();
    s.players.P0.hand = s.partDeck.splice(0, 3);
    const c = s.market[0];
    expect(reduce(s, "P0", { type: "acquire-market", instance: c.id }).ok).toBe(
      false,
    );
    const n = go(s, { type: "acquire-market", instance: c.id, discard: c.id });
    expect(n.players.P0.hand).toEqual(s.players.P0.hand);
    expect(n.partDiscard).toContainEqual(c);
    expect(cardCount(n)).toHaveLength(30);
  });
  it("persists blind offers before choosing; rejects pass, redraw, wrong owner and foreign choices", () => {
    let s = ready();
    s = go(s, { type: "draw-blind" });
    const offered = s.pendingAcquisition!.offers;
    expect(offered).toHaveLength(2);
    for (const a of [
      { type: "draw-blind" },
      { type: "pass" },
      { type: "keep-blind", instance: "foreign" },
    ] as Action[])
      expect(reduce(s, "P0", a).ok).toBe(false);
    expect(
      reduce(s, "P1", { type: "keep-blind", instance: offered[0].id }).ok,
    ).toBe(false);
    const n = go(s, { type: "keep-blind", instance: offered[0].id });
    expect(n.players.P0.hand).toEqual([offered[0]]);
    expect(n.partDiscard).toContainEqual(offered[1]);
    expect(n.pendingAcquisition).toBeNull();
    expect(cardCount(n)).toHaveLength(30);
  });
  it("draws from recycled piles, handles one/zero remaining cards, and never borrows from hands", () => {
    const s = ready();
    s.partDeck = [];
    s.partDiscard = [s.market.pop()!];
    const n = go(s, { type: "draw-blind" });
    expect(n.pendingAcquisition!.offers).toHaveLength(1);
    const x = go(n, {
      type: "keep-blind",
      instance: n.pendingAcquisition!.offers[0].id,
    });
    x.activePlayer = "P0";
    expect(legalActions(x, "P0").some((a) => a.type === "draw-blind")).toBe(
      false,
    );
  });
  it("pays installation and preserves enhancements when replacing the core; starters leave play", () => {
    const s = phase("install");
    fit(s, "flywheel");
    const card = { id: "new-core", definitionId: "compound-piston" };
    s.players.P0.hand = [card];
    const n = go(s, { type: "install", instance: card.id });
    expect(n.players.P0.resources.gears).toBe(0);
    expect(n.players.P0.stations.conversion.core).toEqual(card);
    expect(n.players.P0.stations.conversion.enhancements[0]?.definitionId).toBe(
      "flywheel",
    );
    expect(n.partDiscard).toHaveLength(0);
    expect(n.players.P0.hand).toHaveLength(0);
  });
  it("rejects unaffordable, foreign, duplicate and invalid-slot installs without mutating anything", () => {
    const s = phase("install");
    fit(s, "flywheel");
    s.players.P0.hand = [
      { id: "fly", definitionId: "flywheel" },
      { id: "expensive", definitionId: "industrial-boiler" },
      { id: "cutter", definitionId: "gear-cutter" },
    ];
    for (const a of [
      { type: "install", instance: "fly", slot: 1 },
      { type: "install", instance: "expensive" },
      { type: "install", instance: "foreign" },
      { type: "install", instance: "cutter", slot: 7 },
    ] as Action[]) {
      const r = reduce(s, "P0", a);
      expect(r.ok).toBe(false);
      expect(r.state).toBe(s);
    }
  });
  it("recycles purchased replacements and full enhancement replacements in the parts pile only", () => {
    const s = phase("install");
    fit(s, "compound-piston");
    fit(s, "flywheel");
    fit(s, "steam-economizer", 1);
    s.players.P0.resources.gears = 8;
    s.players.P0.hand = [{ id: "sync", definitionId: "synchronizer" }];
    const n = go(s, { type: "install", instance: "sync", slot: 0 });
    expect(n.partDiscard.map((c) => c.definitionId)).toContain("flywheel");
    expect(n.orderDiscard).toHaveLength(0);
    expect(n.players.P0.stations.conversion.enhancements[1]?.definitionId).toBe(
      "steam-economizer",
    );
  });
  it("produces the starter chain once; commitment and preview agree", () => {
    const s = phase("run"),
      expected = productionPlan(s, "P0"),
      n = go(s, { type: "produce" });
    expect(expected.after).toEqual({ coal: 0, steam: 1, work: 0, gears: 4 });
    expect(n.players.P0.resources).toEqual(expected.after);
    expect(expected.steps.filter((s) => s.operated)).toHaveLength(3);
    expect(n.activePlayer).toBe("P1");
    expect(reduce(n, "P0", { type: "produce" }).ok).toBe(false);
  });
  it("requires full input before Heat Recovery refund and ignores enhancements on skipped cores", () => {
    const s = phase("run");
    fit(s, "industrial-boiler");
    fit(s, "heat-recovery");
    s.players.P0.resources.coal = 1;
    expect(productionPlan(s, "P0").steps[0].reason).toContain("Needs 1 coal");
    s.players.P0.resources.coal = 2;
    const p = productionPlan(s, "P0");
    expect(p.steps[0].input).toEqual({ coal: 2 });
    expect(p.steps[0].refunds).toEqual({ coal: 1 });
    expect(p.after.coal).toBe(1);
  });
  it("chains on generated output despite caps, but counts only retained conditional benefits for the objective", () => {
    const s = phase("run");
    fit(s, "compound-piston");
    fit(s, "flywheel");
    fit(s, "batch-die");
    s.players.P0.resources = { coal: 1, steam: 8, work: 7, gears: 8 };
    const p = productionPlan(s, "P0");
    expect(p.steps[1].generated.work).toBe(3);
    expect(p.steps[1].retained.work).toBe(1);
    expect(p.steps[2].generated.gears).toBe(3);
    expect(p.steps[2].retained.gears).toBe(0);
    expect(p.steps[2].bonuses[0].triggered).toBe(true);
    expect(p.conditionalBenefit).toBe(false);
    s.players.P0.resources.gears = 6;
    expect(productionPlan(s, "P0").conditionalBenefit).toBe(true);
  });
  it("allocates capped benefits to base, unconditional, then conditional output", () => {
    const s = phase("run");
    fit(s, "pressure-tank");
    fit(s, "insulation", 1);
    s.players.P0.resources.steam = 0;
    expect(productionPlan(s, "P0").steps[0].generated.steam).toBe(5);
    fit(s, "compound-piston");
    fit(s, "flywheel");
    fit(s, "gear-cutter");
    fit(s, "batch-die", 1);
    s.players.P0.resources.gears = 6;
    const p = productionPlan(s, "P0");
    expect(p.steps[2].bonuses.find((b) => b.id === "batch-die")?.retained).toBe(
      0,
    );
  });
  it("switches stations independently, resets chain conditions, and keeps choices across rounds", () => {
    const s = phase("run");
    fit(s, "synchronizer");
    s.players.P0.resources = { coal: 2, steam: 4, work: 0, gears: 0 };
    const switched = go(s, {
      type: "set-stations",
      enabled: [false, true, false],
    });
    expect(switched.activePlayer).toBe("P0");
    expect(switched.counts.P0).toBe(0);
    const p = productionPlan(switched, "P0");
    expect(p.after).toEqual({ coal: 2, steam: 3, work: 1, gears: 0 });
    expect(p.steps[1].bonuses[0].triggered).toBe(false);
    let n = go(switched, { type: "produce" });
    n = go(n, { type: "pass" });
    n = go(n, { type: "pass" });
    n = go(n, { type: "pass" });
    expect(n.round).toBe(2);
    expect(n.players.P0.stations.energy.enabled).toBe(false);
  });
  it("enhancement slot order has no mechanical effect", () => {
    const s = phase("run");
    fit(s, "industrial-boiler");
    fit(s, "insulation");
    fit(s, "heat-recovery", 1);
    s.players.P0.resources.coal = 2;
    const p = productionPlan(s, "P0");
    s.players.P0.stations.energy.enhancements.reverse();
    expect(productionPlan(s, "P0")).toEqual(p);
  });
  it("installation preview deducts its price before estimating output without changing the state", () => {
    const s = phase("install");
    s.players.P0.hand = [{ id: "cutter", definitionId: "gear-cutter" }];
    const before = structuredClone(s),
      p = installationPreview(s, "P0", {
        type: "install",
        instance: "cutter",
        slot: 0,
      })!;
    expect(p.reservesAfterPayment.gears).toBe(0);
    expect(p.before.after.gears).toBe(4);
    expect(p.after.after.gears).toBe(2);
    expect(s).toEqual(before);
  });
  it("pays mixed commissions atomically and refills only after both delivery opportunities", () => {
    const s = phase("deliver");
    s.orders = [{ id: "order", definitionId: "transit-hub" }];
    s.players.P0.resources = { coal: 1, steam: 2, work: 1, gears: 3 };
    expect(reduce(s, "P0", { type: "deliver", commission: "order" }).ok).toBe(
      false,
    );
    s.players.P0.resources.work = 2;
    let n = go(s, { type: "deliver", commission: "order" });
    expect(n.players.P0.resources).toEqual({
      coal: 1,
      steam: 0,
      work: 0,
      gears: 1,
    });
    expect(n.players.P0.prestige).toBe(4);
    expect(n.orders).toHaveLength(0);
    n = go(n, { type: "pass" });
    expect(n.orders).toHaveLength(3);
  });
  it("rotates exactly the oldest two remaining parts on continuing rounds and preserves all card instances", () => {
    let s = ready();
    s = go(s, { type: "acquire-market", instance: s.market[1].id });
    s = go(s, { type: "acquire-market", instance: s.market[3].id });
    const old = s.market.map((c) => c.id);
    s.phase = "deliver";
    s.counts = { P0: 0, P1: 0 };
    s.passed = { P0: false, P1: false };
    s.activePlayer = "P0";
    s = go(s, { type: "pass" });
    s = go(s, { type: "pass" });
    expect(s.market.slice(0, 4).map((c) => c.id)).toEqual(old.slice(2));
    expect(s.partDiscard.map((c) => c.id)).toEqual(old.slice(0, 2));
    expect(cardCount(s)).toHaveLength(30);
    expect(new Set(cardCount(s).map((c) => c.id)).size).toBe(30);
  });
  it("continues beyond rounds 8 and 10; public target waits for the rival delivery, then bonuses decide", () => {
    let s = phase("deliver");
    s.round = 10;
    s.players.P0.prestige = 16;
    s.players.P1.prestige = 16;
    s.objectivesPrivate.P0.selected = "modernizer";
    s.objectivesPrivate.P1.selected = "reserve-planner";
    s.players.P1.resources = { coal: 0, steam: 4, work: 4, gears: 0 };
    s.orders = [{ id: "clock", definitionId: "street-clock" }];
    s = go(s, { type: "deliver", commission: "clock" });
    expect(s.status).toBe("active");
    expect(s.activePlayer).toBe("P1");
    s = go(s, { type: "pass" });
    expect(s.finalScores).toEqual({ P0: 18, P1: 19 });
    expect(s.winner).toBe("P1");
    expect(s.round).toBe(10);
    let n = phase("deliver");
    n.round = 10;
    n = go(n, { type: "pass" });
    n = go(n, { type: "pass" });
    expect(n.round).toBe(11);
    expect(n.status).toBe("active");
  });
  it("handles zero/both objectives, gear tiebreaks, full draws and off-turn concession", () => {
    for (const complete of [false, true])
      for (const extra of [0, 1]) {
        let s = phase("deliver");
        s.players.P0.prestige = s.players.P1.prestige = 18;
        for (const seat of ["P0", "P1"] as Seat[]) {
          s.objectivesPrivate[seat].selected = "reserve-planner";
          s.players[seat].resources.steam = complete ? 4 : 0;
          s.players[seat].resources.work = complete ? 4 : 0;
        }
        s.players.P0.resources.gears += extra;
        s = go(s, { type: "pass" });
        s = go(s, { type: "pass" });
        expect(s.finalScores).toEqual({
          P0: complete ? 21 : 18,
          P1: complete ? 21 : 18,
        });
        expect(s.winner).toBe(extra ? "P0" : "draw");
      }
    const s = go(ready(), { type: "concede" }, "P1");
    expect(s.winner).toBe("P0");
    expect(s.revealedObjectives!.P0.bonus).toBe(0);
  });
  it("evaluates all new objective metrics and reserves after delivery", () => {
    const p = ready().players.P0,
      metrics = { modernized: [...STATIONS], synchronizedRounds: [1, 3, 4] };
    p.delivered = [
      "district-heating",
      "transit-hub",
      "factory-automata",
      "district-heating",
      "factory-automata",
    ];
    for (const id of [
      "steam-supplier",
      "industrial-supplier",
      "guild-portfolio",
      "modernizer",
      "synchronized-workshop",
    ] as const)
      expect(objectiveProgress(id, metrics, p).complete).toBe(true);
    p.resources.steam = 4;
    p.resources.work = 4;
    expect(objectiveProgress("reserve-planner", metrics, p).complete).toBe(
      true,
    );
    p.resources.work = 3;
    expect(objectiveProgress("reserve-planner", metrics, p).complete).toBe(
      false,
    );
  });
  it("omits hidden hands, blind choices, discards, randomness and objectives from rival/spectator/report views", () => {
    let s = ready();
    s = go(s, { type: "draw-blind" });
    const choices = s.pendingAcquisition!.offers;
    for (const v of [
      project(s, "P1"),
      project(s),
      publicReport(project(s, "P0")),
    ]) {
      const json = JSON.stringify(v);
      for (const c of choices) expect(json).not.toContain(c.id);
      for (const field of [
        "privateSetup",
        "entropy",
        'partDeck":',
        'partDiscard":',
        "objectivesPrivate",
        "blindChoices",
      ])
        expect(json).not.toContain(field);
    }
    expect(project(s, "P0").blindChoices).toEqual(choices);
    s = go(s, { type: "keep-blind", instance: choices[0].id });
    expect(JSON.stringify(project(s, "P1"))).not.toContain(choices[0].id);
    expect(JSON.stringify(publicReport(s))).not.toContain(choices[1].id);
  });
  it("replays a pending blind choice and preserves long legal matches beyond 1000 commands", () => {
    let s = fresh();
    const actions: AcceptedAction[] = [];
    const act = (action: Action) => {
      const actor = s.activePlayer!;
      s = go(s, action);
      actions.push({ actor, action });
    };
    act({ type: "choose-objective", objective: s.offers.P0[0] });
    act({ type: "choose-objective", objective: s.offers.P1[0] });
    act({ type: "draw-blind" });
    expect(loadGame(JSON.stringify(saveGame(s, actions))).state).toEqual(s);
    act({ type: "keep-blind", instance: s.pendingAcquisition!.offers[0].id });
    for (let i = 0; i < 1002; i++) act({ type: "pass" });
    expect(s.status).toBe("active");
    expect(s.round).toBeGreaterThan(80);
    expect(loadGame(JSON.stringify(saveGame(s, actions))).state).toEqual(s);
    expect(() =>
      loadGame(
        JSON.stringify({ ...saveGame(s, actions), rulesVersion: "0.2.0" }),
      ),
    ).toThrow("0.2.0");
  });
  it("reproduces the documented eight-round arithmetic example with fixed available cards and orders", () => {
    const s = phase("run"),
      expected = [
        [1, 1, 2, 0],
        [2, 2, 3, 0],
        [3, 2, 3, 0],
        [2, 0, 2, 4],
        [3, 0, 1, 9],
        [4, 0, 0, 14],
        [1, 0, 3, 17],
        [2, 0, 2, 22],
      ];
    const installs: Record<number, string> = {
      1: "flywheel",
      3: "precision-press",
      4: "gear-cutter",
    };
    const deliveries: Record<number, string> = {
      4: "transit-hub",
      5: "observatory",
      6: "observatory",
      7: "district-heating",
      8: "observatory",
    };
    for (let round = 1; round <= 8; round++) {
      const p = s.players.P0;
      p.resources.coal = Math.min(8, p.resources.coal + (round % 2 ? 2 : 1));
      if (installs[round]) {
        const id = installs[round];
        expect(p.resources.gears).toBeGreaterThanOrEqual(PARTS[id].price);
        p.resources.gears -= PARTS[id].price;
        fit(s, id);
      }
      p.resources = productionPlan(s, "P0").after;
      const order = deliveries[round] ? ORDERS[deliveries[round]] : null;
      if (order) {
        for (const k of ["coal", "steam", "work", "gears"] as const)
          p.resources[k] -= order.cost[k] ?? 0;
        p.prestige += order.prestige;
      }
      expect([
        p.resources.steam,
        p.resources.work,
        p.resources.gears,
        p.prestige,
      ]).toEqual(expected[round - 1]);
    }
  });
  it("finishes varied complete bot matches with conservation, bounded resources and exact private replay", () => {
    for (let n = 0; n < 12; n++) {
      let s = setup({ seed: n, rulesVersion: VERSION }),
        actions: AcceptedAction[] = [];
      while (s.status === "active") {
        const actor = s.activePlayer!,
          action = chooseBotAction(s);
        s = go(s, action);
        actions.push({ actor, action });
        expect(actions.length).toBeLessThan(800);
        expect(cardCount(s)).toHaveLength(30);
        expect(new Set(cardCount(s).map((c) => c.id)).size).toBe(30);
        const commissions = [...s.orderDeck, ...s.orders, ...s.orderDiscard];
        expect(commissions).toHaveLength(18);
        expect(new Set(commissions.map((c) => c.id)).size).toBe(18);
        for (const seat of ["P0", "P1"] as Seat[])
          for (const v of Object.values(s.players[seat].resources))
            expect(v >= 0 && v <= 8).toBe(true);
      }
      expect(loadGame(JSON.stringify(saveGame(s, actions))).state).toEqual(s);
    }
  });
});
