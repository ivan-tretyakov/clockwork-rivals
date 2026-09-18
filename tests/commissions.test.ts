import { describe, it, expect } from "vitest";
import {
  setup,
  VERSION,
  reduce,
  legalActions,
  ORDERS,
  missingCost,
  objectiveProgress,
  chooseBotAction,
  loadGame,
  saveGame,
  type State,
  type Action,
  type AcceptedAction,
} from "../packages/clockwork-rules/src/legacy-v2";
const fresh = () =>
  setup({
    seed: 1847,
    rulesVersion: VERSION,
    initiativeOverride: "P0",
    config: { objectives: "off", commissions: "mixed" },
  });
const play = (s: State, a: Action) => {
  const r = reduce(s, s.activePlayer!, a);
  if (!r.ok) throw Error(r.message);
  return r.state;
};
describe("Mixed commissions", () => {
  it("keeps classic recipes as compatibility cases and adds only two mixed types", () => {
    expect(ORDERS["street-clock"].cost).toEqual({ gears: 2 });
    expect(ORDERS.observatory.cost).toEqual({ gears: 4 });
    expect(Object.keys(ORDERS)).toHaveLength(5);
    const s = setup({
      seed: 1847,
      rulesVersion: VERSION,
      config: { objectives: "off", commissions: "classic" },
    });
    expect(
      [...s.orders, ...s.orderDeck].some(
        (c) => c.definitionId === "steamworks",
      ),
    ).toBe(false);
    expect(
      [...fresh().orders, ...fresh().orderDeck].filter(
        (c) => c.definitionId === "steamworks",
      ),
    ).toHaveLength(3);
  });
  it("pays mixed costs atomically and cannot partially spend an affordable resource", () => {
    let s = fresh();
    s.phase = "deliver";
    s.orders = [
      { id: "steam-order", definitionId: "steamworks" },
      { id: "work-order", definitionId: "automated-foundry" },
    ];
    s.players.P0.resources = { coal: 3, steam: 2, work: 2, gears: 1 };
    const failed = reduce(s, "P0", {
      type: "deliver",
      commission: "steam-order",
    });
    expect(failed.ok).toBe(false);
    expect(failed.state).toBe(s);
    expect(missingCost(s.players.P0.resources, ORDERS.steamworks.cost)).toEqual(
      { steam: 1 },
    );
    expect(legalActions(s, "P0")).toContainEqual({
      type: "deliver",
      commission: "work-order",
    });
    s = play(s, { type: "deliver", commission: "work-order" });
    expect(s.players.P0.resources).toEqual({
      coal: 3,
      steam: 2,
      work: 0,
      gears: 0,
    });
    expect(s.players.P0.prestige).toBe(3);
    expect(s.orders).toHaveLength(1);
  });
  it("evaluates reserve objectives after the final commission spends resources", () => {
    let s = fresh();
    s.phase = "deliver";
    s.round = s.config.maxRounds;
    s.players.P0.resources = { coal: 0, steam: 4, work: 0, gears: 1 };
    s.objectivesPrivate.P0.selected = "steam-reserve";
    s.objectivesPrivate.P0.metrics.produced.steam = 10;
    s.orders = [{ id: "steam-order", definitionId: "steamworks" }];
    expect(
      objectiveProgress(
        "steam-reserve",
        s.objectivesPrivate.P0.metrics,
        s.players.P0,
      ).complete,
    ).toBe(true);
    s = play(s, { type: "deliver", commission: "steam-order" });
    s = play(s, { type: "pass" });
    expect(s.players.P0.resources.steam).toBe(1);
    expect(s.revealedObjectives!.P0.bonus).toBe(0);
    expect(s.finalScores!.P0).toBe(3);
  });
  it("completes and replays varied v0.2 games with private objectives, plans and mixed costs", () => {
    for (let seed = 1; seed <= 30; seed++) {
      let s = setup({
        seed,
        rulesVersion: VERSION,
        config: {
          objectives: seed % 2 ? "choice" : "random",
          commissions: seed % 3 ? "mixed" : "classic",
        },
      });
      const actions: AcceptedAction[] = [];
      while (s.status === "active") {
        const action = chooseBotAction(s);
        actions.push({ actor: s.activePlayer!, action });
        s = play(s, action);
        expect(actions.length).toBeLessThan(200);
        for (const p of Object.values(s.players))
          for (const n of Object.values(p.resources)) {
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThanOrEqual(8);
          }
      }
      expect(s.finalScores).not.toBeNull();
      expect(loadGame(JSON.stringify(saveGame(s, actions))).state).toEqual(s);
    }
  });
});
