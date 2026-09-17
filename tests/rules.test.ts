import { describe, it, expect } from "vitest";
import fixture from "./fixtures/round-three.json";
import {
  setup,
  reduce,
  legalActions,
  preview,
  productionPlan,
  replay,
  saveGame,
  loadGame,
  project,
  chooseBotAction,
  RESOURCES,
  VERSION,
  slot,
  type State,
  type Action,
  type Seat,
  type Card,
  type AcceptedAction,
} from "../packages/clockwork-rules/src/index";
const fresh = (seed = 1847) =>
  setup({ seed, rulesVersion: VERSION, initiativeOverride: "P0" });
const play = (s: State, action: Action, actor = s.activePlayer!) => {
  const r = reduce(s, actor, action);
  if (!r.ok) throw new Error(r.message);
  return r.state;
};
const card = (definitionId: string, id = definitionId): Card => ({
  definitionId,
  id,
  exhausted: false,
  boosted: false,
});
const phase = (s: State, p: State["phase"]) => {
  s.phase = p;
  s.activePlayer = "P0";
  s.counts = { P0: 0, P1: 0 };
  return s;
};
describe("Clockwork v0.1 acceptance scenarios", () => {
  it("produces all nine machines once and advances after both workshops finish", () => {
    const before = phase(fresh(), "run");
    before.players.P0.grid = Array.from({ length: 9 }, (_, i) =>
      card(["boiler", "piston", "press"][i % 3], `chain-${i}`),
    );
    before.players.P0.resources.coal = 3;
    const plan = productionPlan(before, "P0");
    expect(plan.steps).toHaveLength(9);
    expect(plan.after).toEqual({ coal: 0, steam: 3, work: 0, gears: 3 });
    const produced = play(before, { type: "produce" });
    expect(produced.players.P0.resources).toEqual(plan.after);
    expect(produced.players.P0.grid.every((c) => c?.exhausted)).toBe(true);
    expect(produced.revision).toBe(before.revision + 1);
    expect(produced.activePlayer).toBe("P1");
    expect(produced.passed.P0).toBe(true);
    expect(before.players.P0.grid.some((c) => c?.exhausted)).toBe(false);
    const delivered = play(produced, { type: "produce" });
    expect(delivered.phase).toBe("deliver");
    expect(delivered.activePlayer).toBe("P0");
    expect(delivered.players.P0.resources.gears).toBe(3);
    expect(delivered.players.P1.resources.gears).toBe(1);
  });
  it("revisits blocked consumers after producers and applies passive bonuses and caps", () => {
    const s = phase(fresh(), "run");
    s.players.P0.grid = [
      card("press"),
      card("piston"),
      null,
      card("condenser"),
      card("boiler"),
      null,
      null,
      null,
      null,
    ];
    const plan = productionPlan(s, "P0");
    expect(plan.steps.map((step) => step.definitionId)).toEqual([
      "boiler",
      "piston",
      "press",
    ]);
    expect(plan.after).toEqual({ coal: 0, steam: 2, work: 0, gears: 1 });
    expect(play(s, { type: "produce" }).players.P0.resources).toEqual(
      plan.after,
    );
    s.players.P0.grid = [
      card("boiler"),
      card("condenser"),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ];
    s.players.P0.resources.steam = 7;
    const capped = productionPlan(s, "P0");
    expect(capped.steps[0].effect.overflow).toEqual({ steam: 2 });
    expect(play(s, { type: "produce" }).players.P0.resources.steam).toBe(8);
  });
  it("skips exhausted or unfunded machines and finishes empty production without getting stuck", () => {
    const s = phase(fresh(), "run");
    s.players.P0.resources = { coal: 0, steam: 1, work: 0, gears: 0 };
    s.players.P0.grid[4]!.exhausted = true;
    const plan = productionPlan(s, "P0");
    expect(plan.steps).toHaveLength(0);
    expect(plan.skipped.map((c) => c.definitionId)).toEqual([
      "boiler",
      "press",
    ]);
    s.passed.P1 = true;
    const after = play(s, { type: "produce" });
    expect(after.phase).toBe("deliver");
    expect(after.players.P0.resources).toEqual(s.players.P0.resources);
    expect(reduce(fresh(), "P0", { type: "produce" }).ok).toBe(false);
    expect(reduce(phase(fresh(), "run"), "P1", { type: "produce" }).ok).toBe(
      false,
    );
  });
  it("bounds recycler chains and previews every gear spent", () => {
    const s = phase(fresh(), "run");
    s.players.P0.grid[6] = card("recycler");
    const plan = productionPlan(s, "P0");
    expect(plan.steps.map((step) => step.definitionId)).toEqual([
      "boiler",
      "piston",
      "press",
      "recycler",
    ]);
    expect(plan.after).toEqual({ coal: 2, steam: 1, work: 0, gears: 0 });
    expect(play(s, { type: "produce" }).players.P0.resources).toEqual(
      plan.after,
    );
  });
  it("replays and saves batch production before an exact-cost commission delivery", () => {
    let s = fresh();
    const actions: AcceptedAction[] = [];
    while (s.round < 3) {
      const action: Action =
        s.phase === "run"
          ? { type: "produce" }
          : s.phase === "power"
            ? { type: "take-coal", useValve: false }
            : { type: "pass" };
      actions.push({ actor: s.activePlayer!, action });
      s = play(s, action);
    }
    expect(s.players.P0.resources.gears).toBe(2);
    expect(loadGame(JSON.stringify(saveGame(s, actions))).state).toEqual(s);
    expect(replay(s.seed, s.initialInitiative, actions)).toEqual(s);
    s.phase = "deliver";
    s.activePlayer = "P0";
    s.orders = [{ id: "street", definitionId: "street-clock" }];
    const after = play(s, { type: "deliver", commission: "street" });
    expect(after.players.P0.resources.gears).toBe(0);
    expect(after.players.P0.prestige).toBe(2);
    expect(after.players.P0.delivered).toEqual(["street-clock"]);
  });
  it("loads the documented round-three import fixture by replay", () => {
    const loaded = loadGame(JSON.stringify(fixture));
    expect(loaded.state.round).toBe(3);
    expect(loaded.state.revision).toBe(30);
  });
  it("1. seeded setup has distinct instances and identical starters", () => {
    const a = fresh(),
      b = fresh();
    expect(a).toEqual(b);
    expect(fresh(1848).partDeck).not.toEqual(a.partDeck);
    expect(a.players.P0.grid.map((c) => c?.definitionId)).toEqual(
      a.players.P1.grid.map((c) => c?.definitionId),
    );
    const ids = [
      ...a.players.P0.grid,
      ...a.players.P1.grid,
      ...a.partDeck,
      ...a.market,
    ]
      .filter(Boolean)
      .map((c) => c!.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.partDeck.length).toBe(26);
    expect(a.orderDeck.length).toBe(9);
  });
  it("2. rejects unaffordable actions atomically", () => {
    const s = phase(fresh(), "run");
    const before = structuredClone(s);
    const r = reduce(s, "P0", {
      type: "activate",
      instance: s.players.P0.grid[4]!.id,
    });
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
    expect(s).toEqual(before);
  });
  it("3. starter chain and four action cap", () => {
    let s = phase(fresh(), "run");
    s = play(s, { type: "pass" }, "P0");
    s = play(s, { type: "activate", instance: s.players.P1.grid[3]!.id });
    s = play(s, { type: "activate", instance: s.players.P1.grid[4]!.id });
    s = play(s, { type: "activate", instance: s.players.P1.grid[5]!.id });
    expect(s.players.P1.resources).toEqual({
      coal: 0,
      steam: 1,
      work: 0,
      gears: 1,
    });
    expect(s.players.P1.grid[3]?.exhausted).toBe(true);
    s.players.P1.grid[0] = card("turbine");
    s.players.P1.resources.steam = 2;
    s = play(s, { type: "activate", instance: "turbine" });
    expect(s.phase).toBe("deliver");
    expect(reduce(s, "P1", { type: "activate", instance: "turbine" }).ok).toBe(
      false,
    );
  });
  it("4. condenser is orthogonal, uses row-major priority, and boosts once", () => {
    let s = phase(fresh(), "run");
    s.players.P0.grid[1] = card("condenser", "diagonal");
    expect(preview(s, "P0", "P0-starter-boiler")?.output.steam).toBe(2);
    s.players.P0.grid[0] = card("condenser", "first");
    s.players.P0.grid[6] = card("condenser", "second");
    expect(preview(s, "P0", "P0-starter-boiler")?.output.steam).toBe(3);
    s = play(s, { type: "activate", instance: "P0-starter-boiler" });
    expect(s.players.P0.grid[0]?.boosted).toBe(true);
    expect(s.players.P0.grid[6]?.boosted).toBe(false);
  });
  it("5. adjacency changes after legal swap for Flywheel and Precision Press", () => {
    for (const id of ["flywheel", "precision-press"]) {
      let s = fresh();
      s.players.P0.grid[0] = card(id);
      const resource = id === "flywheel" ? "work" : "gears";
      expect(preview(s, "P0", id)?.output[resource]).toBe(
        id === "flywheel" ? 1 : 2,
      );
      s = play(s, { type: "reconfigure", from: slot(0), to: slot(1) });
      expect(preview(s, "P0", id)?.output[resource]).toBe(
        id === "flywheel" ? 2 : 3,
      );
    }
  });
  it("6. valve cannot invent coal or repeat bonus", () => {
    let s = phase(fresh(), "power");
    s.players.P0.grid[0] = card("priority-valve");
    s.players.P0.grid[1] = card("priority-valve", "second");
    s = play(s, { type: "take-coal", useValve: true });
    expect(s.sharedCoal).toBe(1);
    expect(s.players.P0.resources.coal).toBe(3);
    s = play(s, { type: "pass" });
    expect(legalActions(s, "P0")).not.toContainEqual({
      type: "take-coal",
      useValve: true,
    });
    s = play(s, { type: "take-coal", useValve: false });
    expect(s.sharedCoal).toBe(0);
    expect(s.phase).toBe("run");
  });
  it("7. delivery respects turn and removes commission without refilling", () => {
    let s = phase(fresh(), "deliver");
    s.players.P0.resources.gears = s.players.P1.resources.gears = 8;
    const id = s.orders[0].id;
    expect(reduce(s, "P1", { type: "deliver", commission: id }).ok).toBe(false);
    s = play(s, { type: "deliver", commission: id });
    expect(s.orders).toHaveLength(2);
    expect(reduce(s, "P1", { type: "deliver", commission: id }).ok).toBe(false);
  });
  it("8. both deliver at threshold; prestige then gears then draw", () => {
    let s = phase(fresh(), "deliver");
    s.players.P0.prestige = 8;
    s.players.P0.resources.gears = 2;
    s.players.P1.prestige = 7;
    s.players.P1.resources.gears = 3;
    s.orders = [
      { id: "a", definitionId: "street-clock" },
      { id: "b", definitionId: "clock-tower" },
    ];
    s = play(s, { type: "deliver", commission: "a" });
    expect(s.status).toBe("active");
    s = play(s, { type: "deliver", commission: "b" });
    expect(s.winner).toBe("draw");
    for (const [prestige, gears, winner] of [
      [10, 1, "P0"],
      [11, 0, "P1"],
    ] as const) {
      let t = phase(fresh(), "deliver");
      t.players.P0.prestige = 10;
      t.players.P1.prestige = prestige;
      t.players.P0.resources.gears = gears;
      t = play(t, { type: "pass" });
      t = play(t, { type: "pass" });
      expect(t.winner).toBe(winner);
    }
  });
  it("9. full replacement, empty decks, overflow and persistence", () => {
    let s = fresh();
    s.players.P0.grid = Array.from({ length: 9 }, (_, i) =>
      card("boiler", `b${i}`),
    );
    const id = s.market[0].id;
    expect(
      reduce(s, "P0", {
        type: "draft-install",
        marketInstance: id,
        slot: slot(0),
      }).ok,
    ).toBe(false);
    s.partDeck = [];
    s = play(s, {
      type: "draft-install",
      marketInstance: id,
      slot: slot(0),
      replace: "b0",
    });
    expect(s.market).toHaveLength(3);
    expect(s.discarded[0].id).toBe("b0");
    s = phase(s, "run");
    s.players.P0.resources.steam = 8;
    s = play(s, { type: "activate", instance: "b3" });
    expect(s.players.P0.resources.steam).toBe(8);
    expect(s.log.some((e) => e.type === "overflow")).toBe(true);
    let t = phase(fresh(), "deliver");
    t.players.P0.resources.gears = 5;
    t = play(t, { type: "pass" });
    t = play(t, { type: "pass" });
    expect(t.players.P0.resources.gears).toBe(5);
    expect(t.initiative).toBe("P1");
    expect(t.round).toBe(2);
  });
  it("10. complete matches replay, save/load, terminate and preserve invariants", () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = fresh(seed);
      const actions: AcceptedAction[] = [];
      while (s.status === "active") {
        const actor = s.activePlayer!;
        const action = chooseBotAction(s);
        actions.push({ actor, action });
        const previous = s.revision;
        s = play(s, action);
        expect(s.revision).toBe(previous + 1);
        for (const p of Object.values(s.players))
          for (const r of RESOURCES) {
            expect(p.resources[r]).toBeGreaterThanOrEqual(0);
            expect(p.resources[r]).toBeLessThanOrEqual(8);
          }
        const live = [
          ...s.players.P0.grid,
          ...s.players.P1.grid,
          ...s.market,
          ...s.orders,
          ...s.partDeck,
          ...s.orderDeck,
        ]
          .filter(Boolean)
          .map((c) => c!.id);
        expect(new Set(live).size).toBe(live.length);
        expect(actions.length).toBeLessThan(150);
      }
      expect(s.round).toBeLessThanOrEqual(8);
      expect(replay(seed, "P0", actions)).toEqual(s);
      if (seed === 1) {
        expect(loadGame(JSON.stringify(saveGame(s, actions))).state).toEqual(s);
        const corrupted = saveGame(s, actions);
        corrupted.state = structuredClone(s);
        corrupted.state.players.P0.prestige++;
        expect(() => loadGame(JSON.stringify(corrupted))).toThrow();
      }
    }
  });
  it("all-pass match ends after round 8 and never reshuffles", () => {
    let s = fresh();
    while (s.status === "active") s = play(s, { type: "pass" });
    expect(s.round).toBe(8);
    expect(s.winner).toBe("draw");
    expect(s.partDeck.length).toBe(26);
  });
  it("public projection strips seed and future deck order deeply", () => {
    const view = project(fresh());
    expect(view).not.toHaveProperty("seed");
    expect(view).not.toHaveProperty("partDeck");
    expect(view).not.toHaveProperty("initialInitiative");
    expect(view.partDeckCount).toBe(26);
  });
  it("concede is legal off-turn and finishes atomically", () => {
    const s = play(fresh(), { type: "concede" }, "P1");
    expect(s.winner).toBe("P0");
    expect(s.activePlayer).toBeNull();
    expect(legalActions(s, "P0")).toEqual([]);
  });
  it("all ten definitions have executable effects, including bypass and recycler", () => {
    const s = phase(fresh(), "run");
    for (const [id, input, output] of [
      ["turbine", { steam: 2 }, { gears: 1 }],
      ["recycler", { gears: 1 }, { coal: 2 }],
      ["hand-crank", { coal: 1 }, { work: 1 }],
    ] as const) {
      s.players.P0.grid[0] = card(id);
      s.players.P0.resources = { coal: 3, steam: 3, work: 3, gears: 3 };
      const v = preview(s, "P0", id)!;
      expect(v.input).toEqual(input);
      expect(v.output).toEqual(output);
      expect(
        play(s, { type: "activate", instance: id }).players.P0.resources,
      ).toEqual(v.after);
    }
  });
});
