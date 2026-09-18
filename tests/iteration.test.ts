import { describe, it, expect } from "vitest";
import {
  setup,
  VERSION,
  reduce,
  productionPlan,
  normalizedPlan,
  installationPreview,
  adjacencyInfo,
  type State,
  type Card,
  type Action,
  type Seat,
} from "../packages/clockwork-rules/src/legacy-v2";
const fresh = () =>
  setup({
    seed: 1847,
    rulesVersion: VERSION,
    initiativeOverride: "P0",
    config: { objectives: "off" },
  });
const card = (definitionId: string, id = definitionId): Card => ({
  definitionId,
  id,
  exhausted: false,
  boosted: false,
});
const run = () => {
  const s = fresh();
  s.phase = "run";
  return s;
};
const play = (s: State, a: Action, seat: Seat = s.activePlayer!) => {
  const r = reduce(s, seat, a);
  if (!r.ok) throw new Error(r.message);
  return r.state;
};
describe("Player-controlled production", () => {
  it("previews placement under the same reserves and priorities without committing", () => {
    const s = fresh();
    s.market[0] = card("condenser", "market-condenser");
    const original = structuredClone(s);
    const linked = installationPreview(s, "P0", "market-condenser", 0)!;
    expect(linked.linked).toContain(3);
    expect(linked.before.after.steam).toBe(1);
    expect(linked.after.after.steam).toBe(2);
    const unlinked = installationPreview(s, "P0", "market-condenser", 2)!;
    expect(unlinked.linked).toEqual([]);
    expect(unlinked.affected[0].text).toContain("inactive");
    expect(s).toEqual(original);
    const actual = play(s, {
      type: "draft-install",
      marketInstance: "market-condenser",
      slot: { row: 0, column: 0 },
    });
    expect(productionPlan(actual, "P0").after).toEqual(linked.after.after);
    expect(adjacencyInfo(actual, "P0", "market-condenser").text).toContain(
      "active",
    );
  });
  it("keeps the starter chain and known four-gear combo", () => {
    const s = run();
    expect(productionPlan(s, "P0").after.gears).toBe(1);
    s.players.P0.grid[1] = card("flywheel");
    s.players.P0.grid[7] = card("precision-press");
    const ids = [
      s.players.P0.grid[3]!.id,
      "flywheel",
      s.players.P0.grid[4]!.id,
      s.players.P0.grid[5]!.id,
      "precision-press",
    ];
    s.players.P0.productionOrder = ids.map((instance) => ({
      instance,
      enabled: true,
    }));
    expect(productionPlan(s, "P0").after.gears).toBe(4);
  });
  it("protects gears by disabling Recycler, and persists settings", () => {
    let s = run();
    s.players.P0.grid[6] = card("recycler");
    s = play(s, {
      type: "set-plan",
      plan: normalizedPlan(s, "P0").map((e) => ({
        ...e,
        enabled: e.instance !== "recycler",
      })),
    });
    expect(s.activePlayer).toBe("P0");
    expect(s.counts.P0).toBe(0);
    const preview = productionPlan(s, "P0");
    expect(preview.after.gears).toBe(1);
    expect(preview.skipped[0].reason).toMatch(/Disabled/);
    const produced = play(s, { type: "produce" });
    expect(produced.players.P0.resources).toEqual(preview.after);
    expect(produced.players.P0.grid[6]!.exhausted).toBe(false);
    expect(produced.players.P0.productionOrder.at(-1)?.enabled).toBe(false);
    s.players.P0.productionOrder.at(-1)!.enabled = true;
    expect(productionPlan(s, "P0").after).toEqual({
      coal: 2,
      steam: 1,
      work: 0,
      gears: 0,
    });
  });
  it("prioritizes Precision Press equally in either adjacent position", () => {
    for (const index of [1, 7]) {
      let s = run();
      s.players.P0.grid[index] = card("precision-press");
      s.players.P0.resources.work = 1;
      const plan = normalizedPlan(s, "P0");
      plan.unshift(plan.pop()!);
      s = play(s, { type: "set-plan", plan });
      const predicted = productionPlan(s, "P0");
      expect(predicted.after.gears).toBe(3);
      expect(play(s, { type: "produce" }).players.P0.resources).toEqual(
        predicted.after,
      );
    }
  });
  it("rejects duplicate, foreign, incomplete and out-of-phase plans atomically", () => {
    const s = run();
    const plan = normalizedPlan(s, "P0");
    for (const invalid of [
      [plan[0], plan[0], plan[2]],
      plan.slice(1),
      [{ instance: "P1-starter-boiler", enabled: true }, ...plan.slice(1)],
    ]) {
      const r = reduce(s, "P0", { type: "set-plan", plan: invalid });
      expect(r.ok).toBe(false);
      expect(r.state).toBe(s);
    }
    expect(reduce(fresh(), "P0", { type: "set-plan", plan }).ok).toBe(false);
    expect(reduce(s, "P1", { type: "set-plan", plan }).ok).toBe(false);
    expect(
      reduce(s, "P0", { type: "activate", instance: plan[0].instance }).ok,
    ).toBe(false);
  });
  it("revisits upstream dependencies, caps resources and terminates cycles", () => {
    let s = run();
    s.players.P0.grid[0] = card("recycler");
    s.players.P0.grid[1] = card("condenser");
    s.players.P0.resources.steam = 8;
    const plan = normalizedPlan(s, "P0").reverse();
    s = play(s, { type: "set-plan", plan });
    const expected = productionPlan(s, "P0");
    expect(expected.steps.length).toBeLessThanOrEqual(4);
    expect(
      expected.steps.some((e) => Object.keys(e.effect.overflow).length > 0),
    ).toBe(true);
    const next = play(s, { type: "produce" });
    expect(next.players.P0.resources).toEqual(expected.after);
    expect(next.players.P0.grid).toEqual(expected.grid);
  });
});
