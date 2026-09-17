import catalogue from "../../../data/clockwork-rivals.json";
import type {
  ClockworkAction,
  PlayerId,
  Resource,
  GridSlot,
  SetupOptions,
  GameModule,
  RuleError,
} from "../../../contracts/engine-contract";
export type { ClockworkAction as Action, PlayerId as Seat, Resource };
export const VERSION = catalogue.rulesVersion;
export const RESOURCES: Resource[] = ["coal", "steam", "work", "gears"];
export const PHASES = ["draft", "power", "run", "deliver"] as const;
export type Phase = (typeof PHASES)[number];
export type Reserve = Record<Resource, number>;
type Amounts = Partial<Reserve>;
export interface PartDefinition {
  id: string;
  name: string;
  category: string;
  copies: number;
  rulesText: string;
  art: string;
  effect: {
    kind: string;
    input?: Amounts;
    output?: Amounts;
    amount?: number;
    adjacencyBonus?: {
      friendlyDefinition: string;
      output: Amounts;
      stacking: boolean;
    };
  };
}
export const PARTS = Object.fromEntries(
  catalogue.parts.map((p) => [p.id, p]),
) as Record<string, PartDefinition>;
export const ORDERS = Object.fromEntries(
  catalogue.commissions.map((c) => [c.id, c]),
);
export const LIMITS = catalogue.limits;
export const ALLOWANCE: Record<Phase, number> = {
  draft: LIMITS.draftActions,
  power: LIMITS.powerActions,
  run: LIMITS.runActions,
  deliver: LIMITS.deliverActions,
};
export interface Card {
  id: string;
  definitionId: string;
  exhausted: boolean;
  boosted: boolean;
}
export interface Commission {
  id: string;
  definitionId: string;
}
export interface Player {
  resources: Reserve;
  prestige: number;
  grid: (Card | null)[];
  valveUsed: boolean;
  delivered: string[];
}
export interface Event {
  type: string;
  actor?: PlayerId;
  data: Record<string, unknown>;
  text: string;
  round: number;
  phase: Phase;
  revision: number;
}
export interface State {
  game: "clockwork-rivals";
  rulesVersion: string;
  revision: number;
  seed: number;
  initialInitiative: PlayerId;
  round: number;
  phase: Phase;
  initiative: PlayerId;
  activePlayer: PlayerId | null;
  status: "active" | "finished";
  winner: PlayerId | "draw" | null;
  players: Record<PlayerId, Player>;
  sharedCoal: number;
  counts: Record<PlayerId, number>;
  passed: Record<PlayerId, boolean>;
  market: Card[];
  orders: Commission[];
  partDeck: Card[];
  orderDeck: Commission[];
  discarded: (Card | Commission)[];
  log: Event[];
}
export type PublicState = Omit<
  State,
  "seed" | "initialInitiative" | "partDeck" | "orderDeck"
> & { partDeckCount: number; orderDeckCount: number };
export type View = State | PublicState;
export interface AcceptedAction {
  actor: PlayerId;
  action: ClockworkAction;
}
export interface Save {
  formatVersion: 1;
  rulesVersion: string;
  catalogueHash: string;
  seed: number;
  initialInitiative: PlayerId;
  actions: AcceptedAction[];
  state: State;
}
export const other = (p: PlayerId): PlayerId => (p === "P0" ? "P1" : "P0");
export const slot = (n: number): GridSlot => ({
  row: Math.floor(n / 3),
  column: n % 3,
});
export const position = (s: GridSlot) => s.row * 3 + s.column;
export const neighbors = (n: number) =>
  Array.from({ length: 9 }, (_, i) => i).filter(
    (i) =>
      Math.abs(Math.floor(n / 3) - Math.floor(i / 3)) +
        Math.abs((n % 3) - (i % 3)) ===
      1,
  );
export function rng(seed: number) {
  let n = seed >>> 0 || 0x9e3779b9;
  return () => {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    return (n >>> 0) / 4294967296;
  };
}
function shuffle<T>(items: T[], random: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
export function canonical(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(value)
      .sort()
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonical((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}
function hash(text: string) {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0).toString(16);
}
export const CATALOGUE_HASH = hash(canonical(catalogue));
export function setup(options: SetupOptions): State {
  if (options.rulesVersion !== VERSION || !Number.isFinite(options.seed))
    throw new Error("Unsupported rules version or seed.");
  const random = rng(options.seed);
  const rolled: PlayerId = random() < 0.5 ? "P0" : "P1";
  const initiative = options.initiativeOverride ?? rolled;
  const player = (seat: PlayerId): Player => {
    const grid: (Card | null)[] = Array(9).fill(null);
    for (const c of catalogue.setup.starterCards)
      grid[c.row * 3 + c.column] = {
        id: `${seat}-starter-${c.definitionId}`,
        definitionId: c.definitionId,
        exhausted: false,
        boosted: false,
      };
    return {
      grid,
      resources: { ...catalogue.setup.startingResources },
      prestige: 0,
      valveUsed: false,
      delivered: [],
    };
  };
  const partDeck = shuffle(
    catalogue.parts.flatMap((p) =>
      Array.from({ length: p.copies }, (_, i) => ({
        id: `part-${p.id}-${i}`,
        definitionId: p.id,
        exhausted: false,
        boosted: false,
      })),
    ),
    random,
  );
  const orderDeck = shuffle(
    catalogue.commissions.flatMap((c) =>
      Array.from({ length: c.copies }, (_, i) => ({
        id: `order-${c.id}-${i}`,
        definitionId: c.id,
      })),
    ),
    random,
  );
  return {
    game: "clockwork-rivals",
    rulesVersion: VERSION,
    revision: 0,
    seed: options.seed >>> 0,
    initialInitiative: initiative,
    round: 1,
    phase: "draft",
    initiative,
    activePlayer: initiative,
    status: "active",
    winner: null,
    players: { P0: player("P0"), P1: player("P1") },
    sharedCoal: catalogue.setup.sharedCoalPerRound,
    counts: { P0: 0, P1: 0 },
    passed: { P0: false, P1: false },
    market: partDeck.splice(0, catalogue.setup.marketSize),
    orders: orderDeck.splice(0, catalogue.setup.commissionMarketSize),
    partDeck,
    orderDeck,
    discarded: [],
    log: [],
  };
}
export interface Preview {
  input: Amounts;
  output: Amounts;
  after: Reserve;
  overflow: Amounts;
  adjacent: number[];
  condenser: number | null;
  affordable: boolean;
}
export function preview(
  state: View,
  actor: PlayerId,
  instance: string,
): Preview | null {
  const p = state.players[actor];
  const index = p.grid.findIndex((c) => c?.id === instance);
  const card = p.grid[index];
  if (!card) return null;
  const effect = PARTS[card.definitionId].effect;
  if (effect.kind !== "convert") return null;
  const input = { ...effect.input };
  const output = { ...effect.output };
  const adjacent: number[] = [];
  let condenser: number | null = null;
  if (effect.adjacencyBonus) {
    const matches = neighbors(index).filter(
      (n) =>
        p.grid[n]?.definitionId === effect.adjacencyBonus!.friendlyDefinition,
    );
    if (matches.length) {
      adjacent.push(...matches);
      for (const r of RESOURCES)
        output[r] = (output[r] ?? 0) + (effect.adjacencyBonus.output[r] ?? 0);
    }
  }
  if (card.definitionId === "boiler") {
    condenser =
      neighbors(index).find(
        (n) => p.grid[n]?.definitionId === "condenser" && !p.grid[n]!.boosted,
      ) ?? null;
    if (condenser !== null) {
      output.steam = (output.steam ?? 0) + (PARTS.condenser.effect.amount ?? 1);
      adjacent.push(condenser);
    }
  }
  const after = { ...p.resources };
  const overflow: Amounts = {};
  for (const r of RESOURCES) {
    const total = after[r] - (input[r] ?? 0) + (output[r] ?? 0);
    if (total > LIMITS.resourceCap) overflow[r] = total - LIMITS.resourceCap;
    after[r] = Math.min(LIMITS.resourceCap, total);
  }
  return {
    input,
    output,
    after,
    overflow,
    adjacent,
    condenser,
    affordable: RESOURCES.every((r) => p.resources[r] >= (input[r] ?? 0)),
  };
}
export function legalActions(state: View, actor: PlayerId): ClockworkAction[] {
  if (state.status !== "active" || state.activePlayer !== actor) return [];
  const p = state.players[actor];
  const actions: ClockworkAction[] = [];
  const full = p.grid.every(Boolean);
  if (state.phase === "draft") {
    for (const card of state.market)
      for (let i = 0; i < 9; i++)
        if (!p.grid[i] || full)
          actions.push({
            type: "draft-install",
            marketInstance: card.id,
            slot: slot(i),
            ...(p.grid[i] ? { replace: p.grid[i]!.id } : {}),
          });
    for (let from = 0; from < 9; from++)
      if (p.grid[from])
        for (let to = 0; to < 9; to++)
          if (from !== to)
            actions.push({
              type: "reconfigure",
              from: slot(from),
              to: slot(to),
            });
  } else if (state.phase === "power" && state.sharedCoal > 0) {
    actions.push({ type: "take-coal", useValve: false });
    if (
      state.sharedCoal > 1 &&
      !p.valveUsed &&
      p.grid.some((c) => c?.definitionId === "priority-valve")
    )
      actions.push({ type: "take-coal", useValve: true });
  } else if (state.phase === "run") {
    for (const c of p.grid)
      if (c && !c.exhausted && preview(state, actor, c.id)?.affordable)
        actions.push({ type: "activate", instance: c.id });
  } else if (state.phase === "deliver") {
    for (const c of state.orders)
      if (p.resources.gears >= ORDERS[c.definitionId].gearCost)
        actions.push({ type: "deliver", commission: c.id });
  }
  actions.push({ type: "pass" });
  return actions;
}
const names: Record<PlayerId, string> = { P0: "Teal", P1: "Copper" };
export function reduce(state: State, actor: PlayerId, action: ClockworkAction) {
  const fail = (error: RuleError, message: string) => ({
    ok: false as const,
    state,
    error,
    message,
  });
  if (actor !== "P0" && actor !== "P1")
    return fail("NOT_OWNER", "Unknown player.");
  if (state.status !== "active")
    return fail("MATCH_FINISHED", "This match is finished.");
  if (!action || typeof action !== "object")
    return fail("INVALID_ACTION", "Choose an action.");
  if (action.type !== "concede" && state.activePlayer !== actor)
    return fail("WRONG_TURN", "It is your rival’s turn.");
  if (
    action.type !== "concede" &&
    !legalActions(state, actor).some((a) => canonical(a) === canonical(action))
  ) {
    if (action.type === "activate") {
      const c = state.players[actor].grid.find(
        (c) => c?.id === action.instance,
      );
      if (c?.exhausted)
        return fail("ALREADY_USED", "This machine has already run this round.");
      if (c && preview(state, actor, c.id)?.affordable === false)
        return fail(
          "INSUFFICIENT_RESOURCES",
          "Not enough resources to run this machine.",
        );
    }
    return fail(
      "ILLEGAL_TARGET",
      "That action is not legal in the current phase.",
    );
  }
  const s: State = structuredClone(state);
  s.revision++;
  const p = s.players[actor];
  const events: Event[] = [];
  const event = (
    type: string,
    text: string,
    data: Record<string, unknown> = {},
    by?: PlayerId,
  ) => {
    const e = {
      type,
      text,
      data,
      ...(by ? { actor: by } : {}),
      round: s.round,
      phase: s.phase,
      revision: s.revision,
    };
    events.push(e);
    s.log.push(e);
  };
  const clamp = () => {
    for (const r of RESOURCES)
      if (p.resources[r] > LIMITS.resourceCap) {
        const lost = p.resources[r] - LIMITS.resourceCap;
        p.resources[r] = LIMITS.resourceCap;
        event(
          "overflow",
          `${names[actor]} loses ${lost} ${r} above the reserve cap.`,
          { resource: r, amount: lost },
          actor,
        );
      }
  };
  const amounts = (v: Amounts) =>
    RESOURCES.filter((r) => v[r])
      .map((r) => `${v[r]} ${r}`)
      .join(", ");
  switch (action.type) {
    case "concede":
      s.status = "finished";
      s.winner = other(actor);
      s.activePlayer = null;
      event(
        "concede",
        `${names[actor]} concedes. ${names[other(actor)]} wins.`,
        {},
        actor,
      );
      return { ok: true as const, state: s, events };
    case "draft-install": {
      const i = s.market.findIndex((c) => c.id === action.marketInstance);
      const [card] = s.market.splice(i, 1);
      const target = position(action.slot);
      if (p.grid[target]) s.discarded.push(p.grid[target]!);
      p.grid[target] = card;
      if (s.partDeck.length) s.market.splice(i, 0, s.partDeck.shift()!);
      event(
        "draft",
        `${names[actor]} installs ${PARTS[card.definitionId].name} at ${action.slot.row + 1}:${action.slot.column + 1}.`,
        {
          instance: card.id,
          slot: action.slot,
          replaced: action.replace ?? null,
        },
        actor,
      );
      break;
    }
    case "reconfigure": {
      const from = position(action.from),
        to = position(action.to);
      [p.grid[from], p.grid[to]] = [p.grid[to], p.grid[from]];
      event(
        "reconfigure",
        `${names[actor]} rearranges the workshop (${action.from.row + 1}:${action.from.column + 1} ↔ ${action.to.row + 1}:${action.to.column + 1}).`,
        { from: action.from, to: action.to },
        actor,
      );
      break;
    }
    case "take-coal": {
      const amount = action.useValve ? 2 : 1;
      s.sharedCoal -= amount;
      p.resources.coal += amount;
      if (action.useValve) p.valveUsed = true;
      event(
        "coal",
        `${names[actor]} takes ${amount} coal${action.useValve ? " with Priority Valve" : ""}.`,
        { amount },
        actor,
      );
      clamp();
      break;
    }
    case "activate": {
      const effect = preview(s, actor, action.instance)!;
      const card = p.grid.find((c) => c?.id === action.instance)!;
      for (const r of RESOURCES)
        p.resources[r] += (effect.output[r] ?? 0) - (effect.input[r] ?? 0);
      card.exhausted = true;
      if (effect.condenser !== null) p.grid[effect.condenser]!.boosted = true;
      event(
        "activate",
        `${names[actor]} runs ${PARTS[card.definitionId].name}: ${amounts(effect.input)} → ${amounts(effect.output)}${effect.adjacent.length ? " (adjacency bonus)" : ""}.`,
        {
          instance: card.id,
          input: effect.input,
          output: effect.output,
          adjacent: effect.adjacent,
        },
        actor,
      );
      clamp();
      break;
    }
    case "deliver": {
      const i = s.orders.findIndex((c) => c.id === action.commission);
      const [card] = s.orders.splice(i, 1);
      const order = ORDERS[card.definitionId];
      p.resources.gears -= order.gearCost;
      p.prestige += order.prestige;
      p.delivered.push(card.definitionId);
      s.discarded.push(card);
      event(
        "deliver",
        `${names[actor]} delivers ${order.name} for ${order.prestige} prestige.`,
        { commission: card.id, prestige: order.prestige },
        actor,
      );
      break;
    }
    case "pass":
      s.passed[actor] = true;
      event("pass", `${names[actor]} passes ${s.phase}.`, {}, actor);
      break;
  }
  s.counts[actor]++;
  const done = (seat: PlayerId) =>
    s.passed[seat] || s.counts[seat] >= ALLOWANCE[s.phase];
  if (
    (done("P0") && done("P1")) ||
    (s.phase === "power" && s.sharedCoal === 0)
  ) {
    if (s.phase === "deliver") {
      if (
        s.round >= LIMITS.maxRounds ||
        s.players.P0.prestige >= LIMITS.targetPrestige ||
        s.players.P1.prestige >= LIMITS.targetPrestige
      ) {
        const a = s.players.P0,
          b = s.players.P1;
        const difference =
          a.prestige - b.prestige || a.resources.gears - b.resources.gears;
        s.winner = difference > 0 ? "P0" : difference < 0 ? "P1" : "draw";
        s.status = "finished";
        s.activePlayer = null;
        event(
          "finish",
          s.winner === "draw"
            ? "A perfect tie. Both workshops share the honors."
            : `${names[s.winner]} wins with ${s.players[s.winner].prestige} prestige.`,
          { winner: s.winner },
        );
        return { ok: true as const, state: s, events };
      }
      while (
        s.orders.length < catalogue.setup.commissionMarketSize &&
        s.orderDeck.length
      )
        s.orders.push(s.orderDeck.shift()!);
      s.round++;
      s.initiative = other(s.initiative);
      s.sharedCoal = catalogue.setup.sharedCoalPerRound;
      for (const seat of ["P0", "P1"] as const) {
        s.players[seat].valveUsed = false;
        for (const c of s.players[seat].grid)
          if (c) {
            c.exhausted = false;
            c.boosted = false;
          }
      }
      s.phase = "draft";
      event(
        "round",
        `Round ${s.round}. ${names[s.initiative]} has initiative. Coal refilled to 3.`,
      );
    } else s.phase = PHASES[PHASES.indexOf(s.phase) + 1];
    s.counts = { P0: 0, P1: 0 };
    s.passed = { P0: false, P1: false };
    s.activePlayer = s.initiative;
    event(
      "phase",
      `${s.phase[0].toUpperCase() + s.phase.slice(1)} phase begins. ${names[s.initiative]} goes first.`,
    );
  } else s.activePlayer = done(other(actor)) ? actor : other(actor);
  return { ok: true as const, state: s, events };
}
export function project(s: State): PublicState {
  const {
    seed: _seed,
    initialInitiative: _initiative,
    partDeck,
    orderDeck,
    ...rest
  } = s;
  return structuredClone({
    ...rest,
    partDeckCount: partDeck.length,
    orderDeckCount: orderDeck.length,
  });
}
export function replay(
  seed: number,
  initialInitiative: PlayerId,
  actions: AcceptedAction[],
): State {
  let state = setup({
    seed,
    rulesVersion: VERSION,
    initiativeOverride: initialInitiative,
  });
  for (const { actor, action } of actions) {
    const result = reduce(state, actor, action);
    if (!result.ok)
      throw new Error(
        `Invalid replay at revision ${state.revision}: ${result.message}`,
      );
    state = result.state;
  }
  return state;
}
export function saveGame(state: State, actions: AcceptedAction[]): Save {
  return {
    formatVersion: 1,
    rulesVersion: VERSION,
    catalogueHash: CATALOGUE_HASH,
    seed: state.seed,
    initialInitiative: state.initialInitiative,
    actions,
    state,
  };
}
export function loadGame(raw: string): Save {
  const save = JSON.parse(raw) as Save;
  if (
    save.formatVersion !== 1 ||
    save.rulesVersion !== VERSION ||
    save.catalogueHash !== CATALOGUE_HASH ||
    !Array.isArray(save.actions) ||
    save.actions.length > 1000
  )
    throw new Error("This save uses an unsupported rules catalogue or format.");
  const state = replay(save.seed, save.initialInitiative, save.actions);
  if (canonical(state) !== canonical(save.state))
    throw new Error(
      "Save validation failed. The snapshot does not match its replay.",
    );
  return { ...save, state };
}
export function chooseBotAction(s: View): ClockworkAction {
  const seat = s.activePlayer!;
  const p = s.players[seat];
  const actions = legalActions(s, seat);
  const value = (a: ClockworkAction) => {
    if (a.type === "pass") return -100;
    if (a.type === "reconfigure") return -50;
    if (a.type === "take-coal") return a.useValve ? 20 : 10;
    if (a.type === "deliver")
      return (
        ORDERS[s.orders.find((c) => c.id === a.commission)!.definitionId]
          .prestige * 10
      );
    if (a.type === "activate") {
      const v = preview(s, seat, a.instance)!;
      const id = p.grid.find((c) => c?.id === a.instance)!.definitionId;
      if (id === "recycler")
        return p.resources.coal === 0 && p.resources.gears >= 3 ? 2 : -110;
      return (
        (v.after.gears - p.resources.gears) * 20 +
        (v.after.work - p.resources.work) * (p.resources.work < 3 ? 7 : 1) +
        (v.after.steam - p.resources.steam) *
          (p.resources.steam < 3 ? 4 : 0.3) +
        (v.after.coal - p.resources.coal)
      );
    }
    if (a.type === "draft-install") {
      const id = s.market.find((c) => c.id === a.marketInstance)!.definitionId;
      const values: Record<string, number> = {
        "precision-press": 13,
        turbine: 11,
        flywheel: 10,
        "hand-crank": 7,
        press: 8,
        piston: 5,
        boiler: 6,
        condenser: 4,
        "priority-valve": 3,
        recycler: 1,
      };
      const near = neighbors(position(a.slot)).map(
        (n) => p.grid[n]?.definitionId,
      );
      let v =
        values[id] - p.grid.filter((c) => c?.definitionId === id).length * 6;
      if (
        near.includes("piston") &&
        ["flywheel", "precision-press"].includes(id)
      )
        v += 6;
      if (near.includes("boiler") && id === "condenser") v += 5;
      if (a.replace) {
        const old = p.grid[position(a.slot)]!;
        v -= values[old.definitionId] ?? 8;
        if (
          ["boiler", "piston", "press"].includes(old.definitionId) &&
          p.grid.filter((c) => c?.definitionId === old.definitionId).length ===
            1
        )
          v -= 20;
      }
      return v;
    }
    return -200;
  };
  return (
    [...actions].sort((a, b) => value(b) - value(a))[0] ?? { type: "pass" }
  );
}
// The public contract is satisfied without coupling the rules core to React or a server.
export const clockwork: GameModule<State, ClockworkAction, PublicState> = {
  setup,
  legalActions,
  project,
  reduce,
};
