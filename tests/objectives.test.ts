import { describe, it, expect } from "vitest";
import {
  setup,
  VERSION,
  reduce,
  project,
  publicReport,
  loadGame,
  saveGame,
  replay,
  chooseBotAction,
  objectiveProgress,
  productionPlan,
  type State,
  type Action,
  type AcceptedAction,
  type Seat,
  type Card,
  type PrivateSetup,
} from "../packages/clockwork-rules/src/index";
import { Session } from "../apps/server/src/session";
import oldSave from "./fixtures/round-three.json";
const hidden: PrivateSetup = {
  offers: {
    P0: ["steam-reserve", "productive-shift"],
    P1: ["work-reserve", "guild-portfolio"],
  },
};
const fresh = () =>
  setup({
    seed: 1847,
    rulesVersion: VERSION,
    initiativeOverride: "P0",
    privateSetup: hidden,
  });
const play = (s: State, a: Action, actor: Seat = s.activePlayer!) => {
  const r = reduce(s, actor, a);
  if (!r.ok) throw Error(r.message);
  return r.state;
};
const card = (definitionId: string, id = definitionId): Card => ({
  definitionId,
  id,
  exhausted: false,
  boosted: false,
});
function ready() {
  let s = play(fresh(), {
    type: "choose-objective",
    objective: "productive-shift",
  });
  return play(s, { type: "choose-objective", objective: "guild-portfolio" });
}
describe("Private objectives", () => {
  it("deals four distinct private candidates and locks one each before Draft", () => {
    const s = fresh();
    expect(s.setupComplete).toBe(false);
    expect(s.market.length).toBe(4);
    expect(s.orders.length).toBe(3);
    expect(reduce(s, "P0", { type: "pass" }).ok).toBe(false);
    expect(
      reduce(s, "P0", {
        type: "choose-objective",
        objective: "guild-portfolio",
      }).ok,
    ).toBe(false);
    let chosen = play(s, {
      type: "choose-objective",
      objective: "productive-shift",
    });
    expect(chosen.setupComplete).toBe(false);
    expect(
      reduce(chosen, "P0", {
        type: "choose-objective",
        objective: "steam-reserve",
      }).ok,
    ).toBe(false);
    chosen = play(chosen, {
      type: "choose-objective",
      objective: "guild-portfolio",
    });
    expect(chosen.setupComplete).toBe(true);
    expect(chosen.activePlayer).toBe("P0");
    expect(chosen.counts).toEqual({ P0: 0, P1: 0 });
    expect(
      reduce(chosen, "P0", {
        type: "choose-objective",
        objective: "steam-reserve",
      }).ok,
    ).toBe(false);
  });
  it("supports random assignment and independent private deals with the same public seed", () => {
    const a = setup({
      seed: 1847,
      rulesVersion: VERSION,
      config: { objectives: "random" },
    });
    expect(a.setupComplete).toBe(true);
    expect(a.privateSetup.offers.P0).toHaveLength(1);
    expect(a.objectivesPrivate.P0.selected).not.toBe(
      a.objectivesPrivate.P1.selected,
    );
    const b = setup({
      seed: 1847,
      rulesVersion: VERSION,
      privateSetup: {
        offers: {
          P0: ["work-reserve", "guild-portfolio"],
          P1: ["steam-reserve", "productive-shift"],
        },
      },
    });
    expect(b.market).toEqual(fresh().market);
    expect(b.partDeck).toEqual(fresh().partDeck);
    expect(b.privateSetup).not.toEqual(fresh().privateSetup);
  });
  it("omits opponents' candidates, selections and progress from views, logs and exports", () => {
    for (const s of [fresh(), ready()]) {
      for (const viewer of ["P0", "P1", "spectator"] as const) {
        const view = project(s, viewer);
        const json = JSON.stringify(view);
        expect(view).not.toHaveProperty("privateSetup");
        expect(view).not.toHaveProperty("objectivesPrivate");
        expect(json).not.toContain("coalByRound");
        const blocked =
          viewer === "spectator"
            ? [...hidden.offers.P0, ...hidden.offers.P1]
            : hidden.offers[viewer === "P0" ? "P1" : "P0"];
        for (const id of blocked) expect(json).not.toContain(id);
        for (const id of [...hidden.offers.P0, ...hidden.offers.P1])
          expect(JSON.stringify(publicReport(view))).not.toContain(id);
      }
      expect(JSON.stringify(s.log)).not.toMatch(
        /productive-shift|steam-reserve|work-reserve|guild-portfolio/,
      );
    }
  });
  it("never lets the bot inspect an opponent objective", () => {
    const a = ready(),
      b = structuredClone(a);
    b.objectivesPrivate.P1.selected = "steam-reserve";
    b.objectivesPrivate.P1.metrics.produced.steam = 999;
    expect(chooseBotAction(a)).toEqual(chooseBotAction(b));
  });
  it("counts only capped output, successful types, whole-action net gain and separate zero-coal rounds", () => {
    let s = ready();
    s.phase = "run";
    s.players.P0.resources = { coal: 1, steam: 8, work: 0, gears: 0 };
    s.players.P0.grid = [
      card("boiler"),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ];
    s = play(s, { type: "produce" });
    expect(s.objectivesPrivate.P0.metrics.produced.steam).toBe(0);
    expect(s.objectivesPrivate.P0.metrics.activatedTypes).toEqual(["boiler"]);
    s = ready();
    s.phase = "run";
    s.players.P0.grid[1] = card("flywheel");
    s.players.P0.grid[7] = card("precision-press");
    s.players.P0.productionOrder = [
      "P0-starter-boiler",
      "flywheel",
      "P0-starter-piston",
      "P0-starter-press",
      "precision-press",
    ].map((instance) => ({ instance, enabled: true }));
    const plan = productionPlan(s, "P0");
    expect(plan.after.gears).toBe(4);
    s = play(s, { type: "produce" });
    expect(s.objectivesPrivate.P0.metrics.bestGearGain).toBe(4);
    expect(s.objectivesPrivate.P0.metrics.independentRounds).toEqual([1]);
    expect(s.objectivesPrivate.P0.metrics.activatedTypes).toHaveLength(5);
    s.phase = "run";
    s.round = 2;
    s.activePlayer = "P0";
    s.passed = { P0: false, P1: false };
    s.counts = { P0: 0, P1: 0 };
    for (const c of s.players.P0.grid) if (c) c.exhausted = false;
    s.players.P0.resources.coal = 1;
    s = play(s, { type: "produce" });
    expect(s.objectivesPrivate.P0.metrics.independentRounds).toEqual([1, 2]);
    expect(
      objectiveProgress(
        "independent-shifts",
        s.objectivesPrivate.P0.metrics,
        s.players.P0,
      ).complete,
    ).toBe(true);
    expect(
      objectiveProgress(
        "versatile-workshop",
        s.objectivesPrivate.P0.metrics,
        s.players.P0,
      ).complete,
    ).toBe(true);
  });
  it("does not award independent shifts after taking coal or credit recycled gears as net production", () => {
    let s = ready();
    s.phase = "run";
    s.players.P0.grid[6] = card("recycler");
    s = play(s, { type: "produce" });
    expect(s.objectivesPrivate.P0.metrics.bestGearGain).toBe(0);
    s = ready();
    s.phase = "power";
    s = play(s, { type: "take-coal", useValve: false });
    s.phase = "run";
    s.activePlayer = "P0";
    s.counts = { P0: 0, P1: 0 };
    s.players.P0.resources.work = 4;
    s.players.P0.grid[7] = card("precision-press");
    s = play(s, { type: "produce" });
    expect(s.objectivesPrivate.P0.metrics.bestGearGain).toBeGreaterThanOrEqual(
      2,
    );
    expect(s.objectivesPrivate.P0.metrics.independentRounds).toEqual([]);
  });
  it("evaluates both reserve requirements and portfolio distinctness exactly", () => {
    const s = ready(),
      p = s.players.P0,
      m = s.objectivesPrivate.P0.metrics;
    p.resources.steam = 4;
    m.produced.steam = 9;
    expect(objectiveProgress("steam-reserve", m, p).complete).toBe(false);
    m.produced.steam = 10;
    expect(objectiveProgress("steam-reserve", m, p).complete).toBe(true);
    p.resources.steam = 3;
    expect(objectiveProgress("steam-reserve", m, p).complete).toBe(false);
    p.resources.work = 4;
    m.produced.work = 8;
    expect(objectiveProgress("work-reserve", m, p).complete).toBe(true);
    p.resources.work = 3;
    expect(objectiveProgress("work-reserve", m, p).complete).toBe(false);
    p.delivered = ["street-clock", "street-clock", "clock-tower"];
    expect(objectiveProgress("guild-portfolio", m, p).complete).toBe(false);
    p.delivered.push("observatory");
    expect(objectiveProgress("guild-portfolio", m, p).complete).toBe(true);
  });
  it("scores neither, one or both objectives before declaring a winner, including gear ties and draws", () => {
    for (const [a, b, gears, winner, score0, score1] of [
      [false, false, 0, "P0", 10, 9],
      [false, true, 0, "P1", 10, 11],
      [true, true, 0, "P0", 12, 11],
      [false, true, 2, "P0", 10, 10],
      [false, true, 0, "draw", 10, 10],
    ] as const) {
      let s = ready();
      s.phase = "deliver";
      s.players.P0.prestige = 10;
      s.players.P1.prestige = score1 === 10 ? 8 : 9;
      s.players.P0.resources.gears = gears;
      if (a) s.objectivesPrivate.P0.metrics.bestGearGain = 4;
      if (b)
        s.players.P1.delivered = ["street-clock", "clock-tower", "observatory"];
      s = play(s, { type: "pass" });
      expect(s.status).toBe("active");
      expect(s.revealedObjectives).toBeNull();
      s = play(s, { type: "pass" });
      expect(s.winner).toBe(winner);
      expect(s.finalScores).toEqual({ P0: score0, P1: score1 });
      expect(project(s).revealedObjectives?.P1.selected).toBe(
        "guild-portfolio",
      );
    }
  });
  it("hidden bonuses never trigger an early end and never overturn concession", () => {
    let s = ready();
    s.phase = "deliver";
    s.players.P0.prestige = 8;
    s.objectivesPrivate.P0.metrics.bestGearGain = 4;
    s = play(play(s, { type: "pass" }), { type: "pass" });
    expect(s.status).toBe("active");
    expect(s.revealedObjectives).toBeNull();
    s = play(s, { type: "concede" }, "P0");
    expect(s.winner).toBe("P1");
    expect(s.revealedObjectives?.P0.bonus).toBe(0);
  });
  it("round-trips private authoritative saves and explicitly rejects old versions", () => {
    let s = fresh();
    const actions: AcceptedAction[] = [];
    for (let i = 0; i < 20; i++) {
      const actor = s.activePlayer!;
      const action = chooseBotAction(s);
      actions.push({ actor, action });
      s = play(s, action);
    }
    expect(loadGame(JSON.stringify(saveGame(s, actions))).state).toEqual(s);
    expect(
      replay(s.seed, s.initialInitiative, actions, s.privateSetup, s.config),
    ).toEqual(s);
    expect(() => loadGame(JSON.stringify(oldSave))).toThrow(/older|0.1.0/);
  });
  it("preserves private cards across reconnect and only returns owner-specific session views", () => {
    const room = new Session("private-objectives", "creator");
    room.join("P0");
    room.join("P1");
    const s = room.data.state,
      actor = s.activePlayer!,
      objective = s.privateSetup.offers[actor][0];
    const cmd = {
      matchId: room.data.matchId,
      rulesVersion: VERSION,
      expectedRevision: 0,
      commandId: "choose-private",
      action: { type: "choose-objective" as const, objective },
    };
    const ack = room.command(actor, cmd);
    expect(ack.ok).toBe(true);
    expect(JSON.stringify(ack)).not.toContain(objective);
    const restored = new Session(
      "private-objectives",
      "",
      structuredClone(room.data),
    );
    expect(restored.snapshot(actor).state.objective?.selected).toBe(objective);
    expect(
      JSON.stringify(restored.snapshot(actor === "P0" ? "P1" : "P0")),
    ).not.toContain(objective);
    expect(restored.command(actor, cmd).duplicate).toBe(true);
  });
});
