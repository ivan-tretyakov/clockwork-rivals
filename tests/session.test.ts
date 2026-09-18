import { describe, it, expect } from "vitest";
import { Session } from "../apps/server/src/session";
import {
  VERSION,
  legalActions,
  chooseBotAction,
  replay,
  canonical,
  type Action,
} from "../packages/clockwork-rules/src/index";
const room = () => {
  const r = new Session("test-room", "creator-secret");
  r.join("P0");
  r.join("P1");
  return r;
};
const envelope = (
  r: Session,
  action: Action,
  commandId = crypto.randomUUID(),
) => ({
  matchId: r.data.matchId,
  expectedRevision: r.data.state.revision,
  rulesVersion: VERSION,
  commandId,
  action,
});
describe("Authoritative private sessions", () => {
  it("binds private credentials to seats; invite cannot reclaim occupied seats", () => {
    const r = new Session("id", "creator-secret");
    expect(r.authenticate({ creatorKey: "creator-secret" })).toBe("P0");
    expect(() => r.authenticate({})).toThrow();
    const p0 = r.join("P0");
    expect(r.authenticate({ invite: r.data.invite })).toBe("P1");
    const p1 = r.join("P1");
    expect(() => r.authenticate({ token: p0 })).toThrow("already connected");
    r.leave("P0");
    expect(r.authenticate({ token: p0 })).toBe("P0");
    expect(() => r.authenticate({ invite: r.data.invite })).toThrow();
    expect(() => r.authenticate({ token: p1 })).toThrow();
  });
  it("deduplicates accepted commands before revision checks, rejects changed payload", () => {
    const r = room();
    const actor = r.data.state.activePlayer!;
    const c = envelope(r, chooseBotAction(r.data.state));
    expect(r.command(actor, c).ok).toBe(true);
    expect(r.command(actor, c)).toMatchObject({
      ok: true,
      duplicate: true,
      revision: 1,
    });
    expect(r.data.state.revision).toBe(1);
    expect(
      r.command(actor, { ...c, action: { type: "concede" } }).error,
    ).toContain("reused");
    expect(r.command(actor, { ...c, commandId: "different" }).error).toContain(
      "Stale",
    );
  });
  it("rejects wrong turn, wrong version, wrong match and malformed commands", () => {
    const r = room();
    const inactive = r.data.state.activePlayer === "P0" ? "P1" : "P0";
    expect(r.command(inactive, envelope(r, { type: "pass" })).ok).toBe(false);
    expect(
      r.command("P0", { ...envelope(r, { type: "pass" }), rulesVersion: "0" })
        .ok,
    ).toBe(false);
    expect(
      r.command("P0", { ...envelope(r, { type: "pass" }), matchId: "other" })
        .ok,
    ).toBe(false);
    for (const c of [
      null,
      [],
      { action: {} },
      {
        ...envelope(r, { type: "pass" }),
        action: { type: "activate", instance: [] },
      },
    ])
      expect(r.command("P0", c).ok).toBe(false);
    expect(r.data.state.revision).toBe(0);
  });
  it("pauses disconnected matches and allows off-turn concession", () => {
    const r = room();
    r.leave("P1");
    expect(r.command("P0", envelope(r, { type: "pass" })).error).toContain(
      "paused",
    );
    expect(r.command("P0", envelope(r, { type: "concede" })).ok).toBe(true);
    expect(r.data.state.winner).toBe("P1");
  });
  it("restores state, seat credentials and idempotency through durable serialization", () => {
    const r = room();
    const actor = r.data.state.activePlayer!;
    const c = envelope(r, legalActions(r.data.state, actor)[0]);
    r.command(actor, c);
    const restored = new Session(
      "test-room",
      "",
      JSON.parse(JSON.stringify(r.data)),
    );
    expect(restored.connected).toEqual({ P0: false, P1: false });
    expect(restored.authenticate({ token: r.data.seats.P0.token! })).toBe("P0");
    expect(restored.data.state).toEqual(r.data.state);
    expect(restored.command(actor, c)).toMatchObject({
      ok: true,
      duplicate: true,
    });
    expect(restored.snapshot().state).not.toHaveProperty("seed");
    expect(JSON.stringify(restored.snapshot())).not.toContain(
      r.data.seats.P0.token!,
    );
  });
  it("rolls a move back if durable storage fails", () => {
    let fail = false;
    const r = new Session("r", "c", undefined, () => {
      if (fail) throw new Error("disk full");
    });
    r.join("P0");
    r.join("P1");
    const before = canonical(r.data);
    fail = true;
    expect(
      r.command(
        r.data.state.activePlayer!,
        envelope(r, chooseBotAction(r.data.state)),
      ).ok,
    ).toBe(false);
    expect(canonical(r.data)).toBe(before);
  });
  it("requires mutual rematch agreement, changes match identity and alternates initiative", () => {
    const r = room();
    const match = r.data.matchId;
    const initiative = r.data.state.initialInitiative;
    r.command("P0", envelope(r, { type: "concede" }));
    r.requestRematch("P0");
    expect(r.data.state.status).toBe("finished");
    r.requestRematch("P1");
    expect(r.data.state.status).toBe("active");
    expect(r.data.state.initialInitiative).not.toBe(initiative);
    expect(r.data.matchId).not.toBe(match);
    expect(r.data.state.revision).toBe(0);
    expect(r.data.actions).toEqual([]);
  });
  it("forfeits only after a claimed rival disconnects for 120 seconds", () => {
    const r = room();
    r.leave("P1");
    expect(r.forfeit("P0")).toBe(false);
    r.data.seats.P1.disconnectedAt = Date.now() - 121000;
    expect(r.forfeit("P0")).toBe(true);
    expect(r.data.state.winner).toBe("P0");
  });
  it("plays a complete server-validated match with reproducible log", () => {
    const r = room();
    while (r.data.state.status === "active") {
      const s = r.data.state;
      const c = envelope(r, chooseBotAction(s));
      expect(r.command(s.activePlayer!, c).ok).toBe(true);
      expect(r.data.actions.length).toBeLessThan(800);
    }
    expect(
      replay(
        r.data.state.seed,
        r.data.state.initialInitiative,
        r.data.actions,
        r.data.state.privateSetup,
        r.data.state.config,
      ),
    ).toEqual(r.data.state);
  });
});
