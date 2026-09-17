import { randomBytes, randomUUID } from "node:crypto";
import {
  setup,
  reduce,
  project,
  canonical,
  VERSION,
  other,
  type State,
  type Seat,
  type AcceptedAction,
  type PlaytestConfig,
} from "../../../packages/clockwork-rules/src/index";
import type {
  CommandEnvelope,
  ClockworkAction,
} from "../../../contracts/engine-contract";
export const token = () => randomBytes(32).toString("hex");
export const seed = () => randomBytes(4).readUInt32LE();
export interface RecordData {
  roomId: string;
  invite: string;
  creatorKey: string;
  matchId: string;
  state: State;
  actions: AcceptedAction[];
  seats: Record<Seat, { token: string | null; disconnectedAt: number | null }>;
  acknowledgements: Record<string, { fingerprint: string; response: Reply }>;
  rematch: Record<Seat, boolean>;
  updatedAt: number;
}
export interface Reply {
  ok: boolean;
  commandId?: string;
  revision: number;
  error?: string;
  duplicate?: boolean;
}
export class Session {
  data: RecordData;
  connected: Record<Seat, boolean> = { P0: false, P1: false };
  constructor(
    roomId: string,
    creatorKey: string,
    saved?: RecordData,
    private persist: (data: RecordData) => void = () => {},
    config?: Partial<PlaytestConfig>,
  ) {
    if (saved && saved.state.rulesVersion !== VERSION)
      throw new Error("This room uses older rules. Create a new 0.2 room.");
    this.data = saved ?? {
      roomId,
      invite: token(),
      creatorKey,
      matchId: randomUUID(),
      state: setup({ seed: seed(), rulesVersion: VERSION, config }),
      actions: [],
      seats: {
        P0: { token: null, disconnectedAt: null },
        P1: { token: null, disconnectedAt: null },
      },
      acknowledgements: {},
      rematch: { P0: false, P1: false },
      updatedAt: Date.now(),
    };
    if (saved)
      for (const seat of ["P0", "P1"] as const)
        if (this.data.seats[seat].token)
          this.data.seats[seat].disconnectedAt ??= Date.now();
  }
  commit() {
    this.data.updatedAt = Date.now();
    this.persist(this.data);
  }
  authenticate(options: {
    token?: string;
    invite?: string;
    creatorKey?: string;
  }): Seat {
    for (const seat of ["P0", "P1"] as const)
      if (options.token && options.token === this.data.seats[seat].token) {
        if (this.connected[seat])
          throw new Error("This seat is already connected in another tab.");
        return seat;
      }
    if (
      !this.data.seats.P0.token &&
      options.creatorKey === this.data.creatorKey
    )
      return "P0";
    if (
      !this.data.seats.P1.token &&
      options.invite &&
      options.invite === this.data.invite
    )
      return "P1";
    throw new Error(
      "Invite is invalid, or the seat has already been claimed. Reconnect from the original browser.",
    );
  }
  join(seat: Seat) {
    this.data.seats[seat].token ??= token();
    this.connected[seat] = true;
    this.data.seats[seat].disconnectedAt = null;
    this.commit();
    return this.data.seats[seat].token!;
  }
  leave(seat: Seat) {
    this.connected[seat] = false;
    this.data.seats[seat].disconnectedAt = Date.now();
    this.commit();
  }
  snapshot(viewer: Seat | "spectator" = "spectator") {
    return {
      state: project(this.data.state, viewer),
      matchId: this.data.matchId,
      connected: this.connected,
      claimed: {
        P0: !!this.data.seats.P0.token,
        P1: !!this.data.seats.P1.token,
      },
      rematch: this.data.rematch,
      canClaimForfeit: { P0: this.canForfeit("P0"), P1: this.canForfeit("P1") },
    };
  }
  canForfeit(seat: Seat, now = Date.now()) {
    const rival = other(seat);
    const at = this.data.seats[rival].disconnectedAt;
    return (
      this.connected[seat] &&
      !this.connected[rival] &&
      at !== null &&
      now - at >= 120_000 &&
      this.data.state.status === "active"
    );
  }
  command(seat: Seat, raw: unknown): Reply {
    const revision = this.data.state.revision;
    const fail = (error: string, commandId?: string): Reply => ({
      ok: false,
      revision,
      error,
      ...(commandId ? { commandId } : {}),
    });
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return fail("Invalid command.");
    const c = raw as CommandEnvelope<ClockworkAction>;
    if (
      typeof c.commandId !== "string" ||
      c.commandId.length < 1 ||
      c.commandId.length > 100 ||
      !c.action ||
      typeof c.action !== "object" ||
      !Number.isInteger(c.expectedRevision)
    )
      return fail("Invalid command.");
    if (c.matchId !== this.data.matchId || c.rulesVersion !== VERSION)
      return fail("Match or rules version mismatch.", c.commandId);
    const key = seat + ":" + c.commandId;
    const fingerprint = canonical(c);
    const duplicate = this.data.acknowledgements[key];
    if (duplicate)
      return duplicate.fingerprint === fingerprint
        ? { ...duplicate.response, duplicate: true }
        : fail("Command ID was reused with a different payload.", c.commandId);
    if (c.expectedRevision !== revision)
      return fail(
        "Stale revision. State refreshed; choose your move again.",
        c.commandId,
      );
    if (
      (!this.connected.P0 || !this.connected.P1) &&
      c.action.type !== "concede"
    )
      return fail(
        "Match paused until both players are connected.",
        c.commandId,
      );
    let result;
    try {
      result = reduce(this.data.state, seat, c.action);
    } catch {
      return fail("Invalid action.", c.commandId);
    }
    if (!result.ok) return fail(result.message, c.commandId);
    const old = structuredClone(this.data);
    this.data.state = result.state;
    this.data.actions.push({ actor: seat, action: c.action });
    const response: Reply = {
      ok: true,
      commandId: c.commandId,
      revision: result.state.revision,
    };
    this.data.acknowledgements[key] = { fingerprint, response };
    try {
      this.commit();
    } catch {
      this.data = old;
      return fail("Could not save the move. Please retry.", c.commandId);
    }
    return response;
  }
  requestRematch(seat: Seat) {
    if (this.data.state.status !== "finished") return false;
    this.data.rematch[seat] = true;
    if (
      this.data.rematch.P0 &&
      this.data.rematch.P1 &&
      this.connected.P0 &&
      this.connected.P1
    ) {
      const initiative = other(this.data.state.initialInitiative);
      this.data.state = setup({
        seed: seed(),
        rulesVersion: VERSION,
        initiativeOverride: initiative,
        config: this.data.state.config,
      });
      this.data.matchId = randomUUID();
      this.data.actions = [];
      this.data.acknowledgements = {};
      this.data.rematch = { P0: false, P1: false };
    }
    this.commit();
    return true;
  }
  forfeit(seat: Seat) {
    if (!this.canForfeit(seat)) return false;
    const actor = other(seat);
    const action = { type: "concede" as const };
    const r = reduce(this.data.state, actor, action);
    if (!r.ok) return false;
    this.data.state = r.state;
    this.data.actions.push({ actor, action });
    this.commit();
    return true;
  }
}
