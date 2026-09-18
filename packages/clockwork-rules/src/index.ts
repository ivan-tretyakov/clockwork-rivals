import type {
  ClockworkAction,
  PlaytestConfig,
  SetupOptions,
  RuleError,
} from "../../../contracts/engine-contract";
import {random,stream,type PrivateStream} from './private-random';
import {
  PARTS,
  ORDERS,
  OBJECTIVES,
  STATIONS,
  type Station,
  type Resource,
  type Reserve,
  type Amounts,
  type ObjectiveId,
} from "./catalogue";
export * from "./catalogue";
export type { PlaytestConfig };
export type Action = ClockworkAction;
export type Seat = "P0" | "P1";
export const VERSION = "0.3.0";
export const PHASES = [
  "acquire",
  "install",
  "power",
  "run",
  "deliver",
] as const;
export type Phase = (typeof PHASES)[number];
export const RESOURCES: Resource[] = ["coal", "steam", "work", "gears"];
export const ALLOWANCE: Record<Phase, number> = {
  acquire: 1,
  install: 1,
  power: 2,
  run: 1,
  deliver: 1,
};
export const DEFAULT_CONFIG: PlaytestConfig = {
  targetPrestige: 18,
  objectiveBonus: 3,
  sharedCoal: 3,
};
export const LIMITS = { resourceCap: 8, hand: 3 };
export const other = (s: Seat): Seat => (s === "P0" ? "P1" : "P0");
export const blank = (): Reserve => ({ coal: 0, steam: 0, work: 0, gears: 0 });
export const canAfford = (r: Reserve, c: Amounts) =>
  RESOURCES.every((k) => r[k] >= (c[k] ?? 0));
export const missingCost = (r: Reserve, c: Amounts): Amounts =>
  Object.fromEntries(
    RESOURCES.filter((k) => r[k] < (c[k] ?? 0)).map((k) => [
      k,
      (c[k] ?? 0) - r[k],
    ]),
  );
export const costText = (r: Amounts) =>
  RESOURCES.filter((k) => r[k])
    .map((k) => String(r[k]) + " " + (k === "gears" && r[k] === 1 ? "gear" : k))
    .join(" + ") || "Nothing";
export function canonical(v: unknown): string {
  if (v === undefined) return "undefined";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(v)
      .sort()
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonical((v as Record<string, unknown>)[k]),
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
export const CATALOGUE_HASH = hash(
  canonical({ PARTS, ORDERS, OBJECTIVES, VERSION }),
);
export interface Card {
  id: string;
  definitionId: string;
}
export interface StationState {
  core: Card;
  enhancements: (Card | null)[];
  enabled: boolean;
  operated: boolean;
}
export interface Player {
  stations: Record<Station, StationState>;
  hand: Card[];
  resources: Reserve;
  prestige: number;
  delivered: string[];
}
export interface Metrics {
  modernized: Station[];
  synchronizedRounds: number[];
}
export interface PrivateSetup {
  entropy: number[];
}
export interface Event {
  type: string;
  actor?: Seat;
  text: string;
  round: number;
  phase: Phase;
  revision: number;
  data: Record<string, unknown>;
}
export interface ObjectiveReveal {
  selected: ObjectiveId | null;
  complete: boolean;
  progress: string;
  bonus: number;
}
export interface State {
  game: "clockwork-rivals";
  rulesVersion: string;
  seed: number;
  initialInitiative: Seat;
  config: PlaytestConfig;
  revision: number;
  round: number;
  phase: Phase;
  initiative: Seat;
  activePlayer: Seat | null;
  status: "active" | "finished";
  winner: Seat | "draw" | null;
  setupComplete: boolean;
  sharedCoal: number;
  counts: Record<Seat, number>;
  passed: Record<Seat, boolean>;
  players: Record<Seat, Player>;
  market: Card[];
  orders: Card[];
  partDeck: Card[];
  orderDeck: Card[];
  partDiscard: Card[];
  orderDiscard: Card[];
  privateSetup: PrivateSetup;
  random: Record<"parts" | "orders", PrivateStream>;
  offers: Record<Seat, ObjectiveId[]>;
  objectivesPrivate: Record<
    Seat,
    { selected: ObjectiveId | null; metrics: Metrics }
  >;
  objectiveReady: Record<Seat, boolean>;
  pendingAcquisition: { actor: Seat; offers: Card[] } | null;
  revealedObjectives: Record<Seat, ObjectiveReveal> | null;
  finalScores: Record<Seat, number> | null;
  log: Event[];
}
export interface ObjectiveView {
  offers: ObjectiveId[];
  selected: ObjectiveId | null;
  progress: { complete: boolean; text: string } | null;
}
export type PublicPlayer = Omit<Player, "hand"> & { handCount: number };
export interface PublicState {
  game: "clockwork-rivals";
  rulesVersion: string;
  config: PlaytestConfig;
  revision: number;
  round: number;
  phase: Phase;
  initiative: Seat;
  activePlayer: Seat | null;
  status: "active" | "finished";
  winner: Seat | "draw" | null;
  setupComplete: boolean;
  sharedCoal: number;
  counts: Record<Seat, number>;
  passed: Record<Seat, boolean>;
  players: Record<Seat, PublicPlayer>;
  market: Card[];
  orders: Card[];
  objectiveReady: Record<Seat, boolean>;
  pendingActor: Seat | null;
  partDeckCount: number;
  orderDeckCount: number;
  partDiscardCount: number;
  orderDiscardCount: number;
  revealedObjectives: Record<Seat, ObjectiveReveal> | null;
  finalScores: Record<Seat, number> | null;
  log: Event[];
  hand?: Card[];
  blindChoices?: Card[];
  objective?: ObjectiveView;
}
export type View = State | PublicState;
export interface AcceptedAction {
  actor: Seat;
  action: Action;
}
export interface Save {
  formatVersion: 3;
  rulesVersion: string;
  catalogueHash: string;
  seed: number;
  initialInitiative: Seat;
  privateSetup: PrivateSetup;
  config: PlaytestConfig;
  actions: AcceptedAction[];
  state: State;
}
export function gameConfig(
  input: Partial<PlaytestConfig> = {},
): PlaytestConfig {
  const c = { ...DEFAULT_CONFIG, ...input };
  if (
    Object.keys(c).some(
      (k) => !["targetPrestige", "objectiveBonus", "sharedCoal"].includes(k),
    ) ||
    !Number.isInteger(c.targetPrestige) ||
    c.targetPrestige < 6 ||
    c.targetPrestige > 40 ||
    !Number.isInteger(c.objectiveBonus) ||
    c.objectiveBonus < 0 ||
    c.objectiveBonus > 6 ||
    !Number.isInteger(c.sharedCoal) ||
    c.sharedCoal < 1 ||
    c.sharedCoal > 6
  )
    throw new Error("Invalid playtest configuration.");
  return c;
}
function shuffle<T>(items: T[], stream: PrivateStream) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(stream) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
export function privateDeal(): PrivateSetup {
  return { entropy: Array.from(crypto.getRandomValues(new Uint32Array(24))) };
}
export function setup(
  options: SetupOptions & { privateSetup?: PrivateSetup },
): State {
  if (options.rulesVersion !== VERSION || !Number.isFinite(options.seed))
    throw new Error("Unsupported rules version or seed.");
  const hidden = structuredClone(options.privateSetup ?? privateDeal());
  if (
    !Array.isArray(hidden.entropy) ||
    hidden.entropy.length !== 24 ||
    hidden.entropy.some(
      (n) => !Number.isInteger(n) || n < 0 || n > 0xffffffff,
    ) ||
    [0, 8, 16].some((i) => hidden.entropy.slice(i, i + 8).every((n) => n === 0))
  )
    throw new Error("Invalid private setup.");
  const parts = stream(hidden.entropy.slice(0, 8)),
    orders = stream(hidden.entropy.slice(8, 16)),
    objectiveRng = stream(hidden.entropy.slice(16, 24));
  const rolled: Seat = random(objectiveRng) < 0.5 ? "P0" : "P1";
  const initiative = options.initiativeOverride ?? rolled;
  const offers = shuffle(
    Object.keys(OBJECTIVES) as ObjectiveId[],
    objectiveRng,
  );
  const player = (seat: Seat): Player => ({
    stations: Object.fromEntries(
      STATIONS.map((st, i) => [
        st,
        {
          core: {
            id: seat + "-starter-" + i,
            definitionId: ["basic-boiler", "basic-piston", "basic-press"][i],
          },
          enhancements: [null, null],
          enabled: true,
          operated: false,
        },
      ]),
    ) as Record<Station, StationState>,
    hand: [],
    resources: { coal: 1, steam: 0, work: 0, gears: 3 },
    prestige: 0,
    delivered: [],
  });
  const cards = (
    definitions: string[],
    copies: number,
    stream: PrivateStream,
    prefix: string,
  ) =>
    definitions.flatMap((definitionId, i) =>
      Array.from({ length: copies }, (_, j) => ({
        id:
          prefix +
          Math.floor(random(stream) * 0xffffffff).toString(36) +
          "-" +
          (i * copies + j),
        definitionId,
      })),
    );
  const config = gameConfig(options.config);
  return {
    game: "clockwork-rivals",
    rulesVersion: VERSION,
    seed: options.seed >>> 0,
    initialInitiative: initiative,
    config,
    revision: 0,
    round: 1,
    phase: "acquire",
    initiative,
    activePlayer: initiative,
    status: "active",
    winner: null,
    setupComplete: false,
    sharedCoal: config.sharedCoal,
    counts: { P0: 0, P1: 0 },
    passed: { P0: false, P1: false },
    players: { P0: player("P0"), P1: player("P1") },
    market: [],
    orders: [],
    partDeck: shuffle(
      cards(
        Object.keys(PARTS).filter((k) => !PARTS[k].starter),
        2,
        parts,
        "p",
      ),
      parts,
    ),
    orderDeck: shuffle(cards(Object.keys(ORDERS), 3, orders, "c"), orders),
    partDiscard: [],
    orderDiscard: [],
    privateSetup: hidden,
    random: { parts, orders },
    offers: { P0: offers.slice(0, 2), P1: offers.slice(2, 4) },
    objectivesPrivate: {
      P0: {
        selected: null,
        metrics: { modernized: [], synchronizedRounds: [] },
      },
      P1: {
        selected: null,
        metrics: { modernized: [], synchronizedRounds: [] },
      },
    },
    objectiveReady: { P0: false, P1: false },
    pendingAcquisition: null,
    revealedObjectives: null,
    finalScores: null,
    log: [],
  };
}
function draw(s: State, kind: "parts" | "orders"): Card | undefined {
  const deck = kind === "parts" ? s.partDeck : s.orderDeck,
    discard = kind === "parts" ? s.partDiscard : s.orderDiscard;
  if (!deck.length && discard.length)
    deck.push(...shuffle(discard.splice(0), s.random[kind]));
  return deck.shift();
}
function refill(s: State, kind: "parts" | "orders") {
  const display = kind === "parts" ? s.market : s.orders,
    max = kind === "parts" ? 6 : 3;
  while (display.length < max) {
    const c = draw(s, kind);
    if (!c) break;
    display.push(c);
  }
}
export const handFor = (s: View, seat: Seat): Card[] =>
  "privateSetup" in s ? s.players[seat].hand : (s.hand ?? []);
const pendingFor = (s: View, seat: Seat): Card[] =>
  "privateSetup" in s
    ? s.pendingAcquisition?.actor === seat
      ? s.pendingAcquisition.offers
      : []
    : (s.blindChoices ?? []);
const pendingActor = (s: View) =>
  "privateSetup" in s ? (s.pendingAcquisition?.actor ?? null) : s.pendingActor;
export interface Bonus {
  id: string;
  triggered: boolean;
  amount: number;
  retained: number;
  refund: boolean;
  conditional: boolean;
  reason: string;
}
export interface ProductionStep {
  station: Station;
  core: Card;
  operated: boolean;
  reason: string;
  input: Amounts;
  generated: Amounts;
  retained: Amounts;
  refunds: Amounts;
  overflow: Amounts;
  bonuses: Bonus[];
  after: Reserve;
}
export interface Production {
  steps: ProductionStep[];
  after: Reserve;
  overflow: Reserve;
  conditionalBenefit: boolean;
}
export function productionPlan(
  s: View,
  seat: Seat,
  enabled?: boolean[],
): Production {
  const p = s.players[seat],
    r = { ...p.resources },
    generated = blank(),
    overflow = blank();
  const steps: ProductionStep[] = [];
  let conditionalBenefit = false;
  for (const [i, st] of STATIONS.entries()) {
    const station = p.stations[st],
      core = PARTS[station.core.definitionId],
      input = core.input!;
    const active = enabled?.[i] ?? station.enabled;
    const reason = station.operated
      ? "Already operated this round"
      : !active
        ? "Switched off"
        : !canAfford(r, input)
          ? "Needs " + costText(missingCost(r, input))
          : "";
    const step: ProductionStep = {
      station: st,
      core: station.core,
      operated: !reason,
      reason,
      input: {},
      generated: {},
      retained: {},
      refunds: {},
      overflow: {},
      bonuses: [],
      after: { ...r },
    };
    if (reason) {
      steps.push(step);
      continue;
    }
    const before = { ...r };
    for (const k of RESOURCES) r[k] -= input[k] ?? 0;
    step.input = { ...input };
    const outKey = Object.keys(core.output!)[0] as Resource,
      base = core.output![outKey]!;
    const cards = station.enhancements
      .filter((c): c is Card => !!c)
      .sort((a, b) => a.definitionId.localeCompare(b.definitionId));
    for (const c of cards) {
      const id = c.definitionId;
      let amount = 0,
        refund = false,
        conditional = false,
        why = "";
      switch (id) {
        case "insulation":
        case "flywheel":
        case "gear-cutter":
          amount = 1;
          why = "Always adds output";
          break;
        case "heat-recovery":
          conditional = true;
          refund = true;
          amount = (input.coal ?? 0) >= 2 ? 1 : 0;
          why = amount
            ? "Core paid 2 coal"
            : "Requires a core that pays 2 coal";
          break;
        case "pressure-tank":
          conditional = true;
          amount = before.steam === 0 ? 2 : 0;
          why = amount
            ? "Steam was empty before Energy"
            : "Steam was not empty before Energy";
          break;
        case "steam-economizer":
        case "fine-tooling":
          refund = true;
          amount = 1;
          why = "Full input paid; returns one";
          break;
        case "synchronizer":
          conditional = true;
          amount = generated.steam >= 4 ? 2 : 0;
          why = amount
            ? "Energy generated at least 4 steam"
            : "Energy generated " + generated.steam + "/4 steam";
          break;
        case "batch-die":
          conditional = true;
          amount = generated.work >= 3 ? 2 : 0;
          why = amount
            ? "Conversion generated at least 3 work"
            : "Conversion generated " + generated.work + "/3 work";
          break;
      }
      step.bonuses.push({
        id,
        triggered: amount > 0,
        amount,
        retained: 0,
        refund,
        conditional,
        reason: why,
      });
    }
    const total =
      base +
      step.bonuses.filter((b) => !b.refund).reduce((n, b) => n + b.amount, 0);
    generated[outKey] = total;
    step.generated[outKey] = total;
    const fit = Math.min(8 - r[outKey], total);
    r[outKey] += fit;
    step.retained[outKey] = fit;
    if (total > fit) {
      step.overflow[outKey] = total - fit;
      overflow[outKey] += total - fit;
    }
    // For the private goal only, attribute capacity to base, unconditional, conditional output.
    let room = Math.max(0, fit - base);
    for (const b of [...step.bonuses]
      .filter((b) => !b.refund)
      .sort((a, b) => Number(a.conditional) - Number(b.conditional))) {
      b.retained = Math.min(room, b.amount);
      room -= b.retained;
    }
    for (const b of step.bonuses.filter((b) => b.refund)) {
      const key: Resource =
        st === "energy" ? "coal" : st === "conversion" ? "steam" : "work";
      b.retained = Math.min(8 - r[key], b.amount);
      r[key] += b.retained;
      step.refunds[key] = (step.refunds[key] ?? 0) + b.retained;
      if (b.amount > b.retained) {
        step.overflow[key] = (step.overflow[key] ?? 0) + b.amount - b.retained;
        overflow[key] += b.amount - b.retained;
      }
    }
    if (step.bonuses.some((b) => b.conditional && b.retained > 0))
      conditionalBenefit = true;
    step.after = { ...r };
    steps.push(step);
  }
  return { steps, after: r, overflow, conditionalBenefit };
}
export function objectiveProgress(
  id: ObjectiveId,
  metrics: Metrics,
  p: Pick<Player, "resources" | "delivered">,
) {
  let n = 0,
    target = 3,
    text = "";
  switch (id) {
    case "steam-supplier":
      n = p.delivered.filter((k) => ORDERS[k].cost.steam).length;
      text = n + "/3 steam commissions delivered";
      break;
    case "industrial-supplier":
      n = p.delivered.filter((k) => ORDERS[k].cost.work).length;
      text = n + "/3 work commissions delivered";
      break;
    case "guild-portfolio":
      n = new Set(p.delivered).size;
      text = n + "/3 different commissions delivered";
      break;
    case "modernizer":
      n = metrics.modernized.length;
      text = n + "/3 stations operated with purchased cores";
      break;
    case "synchronized-workshop":
      n = metrics.synchronizedRounds.length;
      text = n + "/3 productions with a retained conditional benefit";
      break;
    case "reserve-planner":
      return {
        complete: p.resources.steam >= 4 && p.resources.work >= 4,
        text:
          p.resources.steam +
          "/4 steam held · " +
          p.resources.work +
          "/4 work held",
      };
  }
  return { complete: n >= target, text };
}
function installationChoices(s: View, seat: Seat): Action[] {
  const p = s.players[seat],
    result: Action[] = [];
  for (const c of handFor(s, seat)) {
    const d = PARTS[c.definitionId],
      st = p.stations[d.station];
    if (p.resources.gears < d.price) continue;
    if (d.kind === "core") {
      if (st.core.definitionId !== d.id)
        result.push({ type: "install", instance: c.id });
    } else if (!st.enhancements.some((e) => e?.definitionId === d.id)) {
      const free = st.enhancements
        .map((e, i) => (e ? null : i))
        .filter((i): i is number => i !== null);
      for (const slot of free.length ? free : [0, 1])
        result.push({ type: "install", instance: c.id, slot });
    }
  }
  return result;
}
export function legalActions(s: View, seat: Seat): Action[] {
  if (s.status !== "active") return [];
  const result: Action[] = [{ type: "concede" }];
  if (s.activePlayer !== seat) return result;
  if (!s.setupComplete) {
    const offers =
      "privateSetup" in s ? s.offers[seat] : (s.objective?.offers ?? []);
    if (!s.objectiveReady[seat])
      result.push(
        ...offers.map((objective) => ({
          type: "choose-objective" as const,
          objective,
        })),
      );
    return result;
  }
  const hand = handFor(s, seat);
  function acquire(type: "acquire-market" | "keep-blind", c: Card) {
    if (hand.length < 3) result.push({ type, instance: c.id });
    else
      for (const discard of [...hand, c])
        result.push({ type, instance: c.id, discard: discard.id });
  }
  if (pendingActor(s)) {
    if (pendingActor(s) === seat)
      for (const c of pendingFor(s, seat)) acquire("keep-blind", c);
    return result;
  }
  result.push({ type: "pass" });
  const p = s.players[seat];
  if (s.phase === "acquire") {
    for (const c of s.market) acquire("acquire-market", c);
    if (
      ("privateSetup" in s
        ? s.partDeck.length + s.partDiscard.length
        : s.partDeckCount + s.partDiscardCount) > 0
    )
      result.push({ type: "draw-blind" });
  } else if (s.phase === "install")
    result.push(...installationChoices(s, seat));
  else if (s.phase === "power" && s.sharedCoal > 0 && p.resources.coal < 8)
    result.push({ type: "take-coal" });
  else if (s.phase === "run") {
    result.push({ type: "produce" });
    for (let i = 0; i < 8; i++) {
      const enabled: [boolean, boolean, boolean] = [
        !!(i & 4),
        !!(i & 2),
        !!(i & 1),
      ];
      if (STATIONS.some((st, j) => p.stations[st].enabled !== enabled[j]))
        result.push({ type: "set-stations", enabled });
    }
  } else if (s.phase === "deliver") {
    for (const c of s.orders)
      if (canAfford(p.resources, ORDERS[c.definitionId].cost))
        result.push({ type: "deliver", commission: c.id });
  }
  return result;
}
function install(
  s: State,
  seat: Seat,
  a: Extract<Action, { type: "install" }>,
) {
  const p = s.players[seat],
    i = p.hand.findIndex((c) => c.id === a.instance),
    c = p.hand[i],
    d = PARTS[c.definitionId],
    st = p.stations[d.station];
  p.resources.gears -= d.price;
  p.hand.splice(i, 1);
  const old = d.kind === "core" ? st.core : st.enhancements[a.slot!];
  if (old && !PARTS[old.definitionId].starter) s.partDiscard.push(old);
  if (d.kind === "core") st.core = c;
  else st.enhancements[a.slot!] = c;
}
export function installationPreview(
  s: View,
  seat: Seat,
  action: Extract<Action, { type: "install" }>,
) {
  if (
    !installationChoices(s, seat).some(
      (a) => canonical(a) === canonical(action),
    )
  )
    return null;
  // Work only on the owner-visible player; no private opponent fields are needed.
  const simulated = structuredClone(s),
    p = simulated.players[seat];
  const hand = structuredClone(handFor(s, seat)),
    c = hand.find((c) => c.id === action.instance)!,
    d = PARTS[c.definitionId],
    st = p.stations[d.station];
  const replaced = d.kind === "core" ? st.core : st.enhancements[action.slot!];
  p.resources.gears -= d.price;
  if (d.kind === "core") st.core = c;
  else st.enhancements[action.slot!] = c;
  return {
    part: c,
    price: d.price,
    replaced,
    stations: p.stations,
    before: productionPlan(s, seat),
    after: productionPlan(simulated, seat),
    reservesAfterPayment: { ...p.resources },
  };
}
function finish(s: State, conceded?: Seat) {
  const reveals = {} as Record<Seat, ObjectiveReveal>,
    scores = {} as Record<Seat, number>;
  for (const seat of ["P0", "P1"] as Seat[]) {
    const own = s.objectivesPrivate[seat],
      progress = own.selected
        ? objectiveProgress(own.selected, own.metrics, s.players[seat])
        : { complete: false, text: "No objective selected" };
    const bonus = !conceded && progress.complete ? s.config.objectiveBonus : 0;
    reveals[seat] = {
      selected: own.selected,
      complete: progress.complete,
      progress: progress.text,
      bonus,
    };
    scores[seat] = s.players[seat].prestige + bonus;
  }
  s.revealedObjectives = reveals;
  s.finalScores = scores;
  s.status = "finished";
  s.activePlayer = null;
  const difference =
    scores.P0 - scores.P1 ||
    s.players.P0.resources.gears - s.players.P1.resources.gears;
  s.winner = conceded
    ? other(conceded)
    : difference > 0
      ? "P0"
      : difference < 0
        ? "P1"
        : "draw";
}
function advance(s: State) {
  const done = (seat: Seat) =>
    s.passed[seat] ||
    s.counts[seat] >= ALLOWANCE[s.phase] ||
    (s.phase === "power" &&
      (s.sharedCoal === 0 || s.players[seat].resources.coal >= 8));
  if (done("P0") && done("P1")) {
    if (s.phase === "deliver") {
      if (
        s.players.P0.prestige >= s.config.targetPrestige ||
        s.players.P1.prestige >= s.config.targetPrestige
      ) {
        finish(s);
        return;
      }
      refill(s, "orders");
      s.partDiscard.push(...s.market.splice(0, 2));
      refill(s, "parts");
      s.round++;
      s.initiative = other(s.initiative);
      s.sharedCoal = s.config.sharedCoal;
      for (const seat of ["P0", "P1"] as Seat[])
        for (const st of STATIONS)
          s.players[seat].stations[st].operated = false;
      s.phase = "acquire";
    } else s.phase = PHASES[PHASES.indexOf(s.phase) + 1];
    s.counts = { P0: 0, P1: 0 };
    s.passed = { P0: false, P1: false };
    s.activePlayer = s.initiative;
    if (s.phase === "power" && done("P0") && done("P1")) advance(s);
  } else {
    const rival = other(s.activePlayer!);
    s.activePlayer = done(rival) ? s.activePlayer : rival;
  }
}
export function reduce(
  state: State,
  actor: Seat,
  action: Action,
):
  | { ok: true; state: State; events: Event[] }
  | { ok: false; state: State; error: RuleError; message: string } {
  const fail = (error: RuleError, message: string) => ({
    ok: false as const,
    state,
    error,
    message,
  });
  if (state.status !== "active")
    return fail("MATCH_FINISHED", "The match has finished.");
  if (actor !== "P0" && actor !== "P1")
    return fail("NOT_OWNER", "Unknown seat.");
  if (state.activePlayer !== actor && action?.type !== "concede")
    return fail("WRONG_TURN", "Wait for your turn.");
  if (
    !legalActions(state, actor).some((a) => canonical(a) === canonical(action))
  )
    return fail(
      "INVALID_ACTION",
      "This action is not available. Check the phase, ownership, price and destination.",
    );
  const s = structuredClone(state),
    p = s.players[actor],
    events: Event[] = [];
  s.revision++;
  const emit = (
    type: string,
    text: string,
    data: Record<string, unknown> = {},
  ) => {
    const e = {
      type,
      actor,
      text,
      round: state.round,
      phase: state.phase,
      revision: s.revision,
      data,
    };
    events.push(e);
    s.log.push(e);
    if (s.log.length > 120) s.log.shift();
  };
  const name = actor === "P0" ? "Teal" : "Copper";
  if (action.type === "concede") {
    finish(s, actor);
    emit("concede", name + " concedes.");
    return { ok: true, state: s, events };
  }
  if (action.type === "choose-objective") {
    s.objectivesPrivate[actor].selected = action.objective as ObjectiveId;
    s.objectiveReady[actor] = true;
    emit("ready", name + " locks a private objective.");
    if (s.objectiveReady.P0 && s.objectiveReady.P1) {
      s.setupComplete = true;
      refill(s, "parts");
      refill(s, "orders");
      s.activePlayer = s.initiative;
    } else s.activePlayer = other(actor);
    return { ok: true, state: s, events };
  }
  if (action.type === "set-stations") {
    STATIONS.forEach((st, i) => (p.stations[st].enabled = action.enabled[i]));
    return { ok: true, state: s, events };
  }
  if (action.type === "draw-blind") {
    const offers: Card[] = [];
    for (let i = 0; i < 2; i++) {
      const c = draw(s, "parts");
      if (c) offers.push(c);
    }
    s.pendingAcquisition = { actor, offers };
    emit("blind", name + " is choosing a private part.");
    return { ok: true, state: s, events };
  }
  if (action.type === "acquire-market" || action.type === "keep-blind") {
    let c: Card;
    if (action.type === "acquire-market") {
      c = s.market.splice(
        s.market.findIndex((c) => c.id === action.instance),
        1,
      )[0];
      refill(s, "parts");
      emit(
        "acquire",
        name + " acquires " + PARTS[c.definitionId].name + " from the market.",
        { definition: c.definitionId },
      );
    } else {
      c = s.pendingAcquisition!.offers.find((c) => c.id === action.instance)!;
      s.partDiscard.push(
        ...s.pendingAcquisition!.offers.filter((k) => k.id !== c.id),
      );
      s.pendingAcquisition = null;
      emit("acquire", name + " keeps one private part.");
    }
    p.hand.push(c);
    if (action.discard) {
      const i = p.hand.findIndex((c) => c.id === action.discard);
      s.partDiscard.push(...p.hand.splice(i, 1));
      emit("discard", name + " discards one part face down.");
    }
  } else if (action.type === "install") {
    const c = p.hand.find((c) => c.id === action.instance)!,
      d = PARTS[c.definitionId];
    install(s, actor, action);
    emit(
      "install",
      name +
        " installs " +
        d.name +
        " in " +
        d.station +
        " for " +
        d.price +
        " gears.",
      { definition: d.id, price: d.price, station: d.station },
    );
  } else if (action.type === "take-coal") {
    p.resources.coal++;
    s.sharedCoal--;
    emit("coal", name + " takes 1 coal.");
  } else if (action.type === "produce") {
    const result = productionPlan(s, actor);
    p.resources = result.after;
    const metrics = s.objectivesPrivate[actor].metrics;
    for (const step of result.steps) {
      p.stations[step.station].operated = step.operated;
      if (step.operated) {
        if (
          !PARTS[step.core.definitionId].starter &&
          !metrics.modernized.includes(step.station)
        )
          metrics.modernized.push(step.station);
        emit(
          "operation",
          name +
            " · " +
            PARTS[step.core.definitionId].name +
            ": " +
            costText(step.input) +
            " → " +
            costText(step.generated) +
            (Object.values(step.refunds).some(Boolean)
              ? " · returns " + costText(step.refunds)
              : "") +
            (Object.values(step.overflow).some(Boolean)
              ? " · overflow " + costText(step.overflow)
              : ""),
        );
      } else
        emit("skip", name + " · " + step.station + ": " + step.reason + ".");
    }
    if (
      result.conditionalBenefit &&
      !metrics.synchronizedRounds.includes(s.round)
    )
      metrics.synchronizedRounds.push(s.round);
  } else if (action.type === "deliver") {
    const i = s.orders.findIndex((c) => c.id === action.commission),
      c = s.orders.splice(i, 1)[0],
      d = ORDERS[c.definitionId];
    for (const k of RESOURCES) p.resources[k] -= d.cost[k] ?? 0;
    p.prestige += d.prestige;
    p.delivered.push(d.id);
    s.orderDiscard.push(c);
    emit(
      "deliver",
      name + " delivers " + d.name + " for " + d.prestige + " prestige.",
      { definition: d.id },
    );
  } else if (action.type === "pass") {
    s.passed[actor] = true;
    emit(
      "pass",
      name +
        (s.phase === "run"
          ? " skips production and keeps reserves."
          : s.phase === "deliver"
            ? " keeps reserves."
            : " finishes " + s.phase + "."),
    );
  }
  s.counts[actor]++;
  advance(s);
  if (s.status === "finished")
    emit(
      "finish",
      s.winner === "draw"
        ? "The rivalry ends in a draw."
        : (s.winner === "P0" ? "Teal" : "Copper") +
            " wins after final objective scoring.",
    );
  else if (s.phase !== state.phase || s.round !== state.round)
    emit("phase", "Round " + s.round + " · " + s.phase + ".");
  return { ok: true, state: s, events };
}
// Whitelist the public shape. Never spread authoritative state or private players into a view.
export function project(
  s: State,
  viewer: Seat | "spectator" = "spectator",
): PublicState {
  const players = {} as Record<Seat, PublicPlayer>;
  for (const seat of ["P0", "P1"] as Seat[]) {
    const p = s.players[seat];
    players[seat] = {
      stations: p.stations,
      resources: p.resources,
      prestige: p.prestige,
      delivered: p.delivered,
      handCount: p.hand.length,
    };
  }
  const result: PublicState = {
    game: s.game,
    rulesVersion: s.rulesVersion,
    config: s.config,
    revision: s.revision,
    round: s.round,
    phase: s.phase,
    initiative: s.initiative,
    activePlayer: s.activePlayer,
    status: s.status,
    winner: s.winner,
    setupComplete: s.setupComplete,
    sharedCoal: s.sharedCoal,
    counts: s.counts,
    passed: s.passed,
    players,
    market: s.market,
    orders: s.orders,
    objectiveReady: s.objectiveReady,
    pendingActor: s.pendingAcquisition?.actor ?? null,
    partDeckCount: s.partDeck.length,
    orderDeckCount: s.orderDeck.length,
    partDiscardCount: s.partDiscard.length,
    orderDiscardCount: s.orderDiscard.length,
    revealedObjectives: s.revealedObjectives,
    finalScores: s.finalScores,
    log: s.log,
  };
  if (viewer !== "spectator") {
    result.hand = s.players[viewer].hand;
    if (s.pendingAcquisition?.actor === viewer)
      result.blindChoices = s.pendingAcquisition.offers;
    if (s.status !== "finished") {
      const own = s.objectivesPrivate[viewer];
      result.objective = {
        offers: own.selected ? [] : s.offers[viewer],
        selected: own.selected,
        progress: own.selected
          ? objectiveProgress(own.selected, own.metrics, s.players[viewer])
          : null,
      };
    }
  }
  return structuredClone(result);
}
export function publicReport(s: View) {
  const {
    hand: _hand,
    objective: _objective,
    blindChoices: _blind,
    ...state
  } = "privateSetup" in s ? project(s) : structuredClone(s);
  return {
    kind: "clockwork-public-report",
    rulesVersion: VERSION,
    state,
    note: "Redacted public report. Private hands, draws, discards, offers and progress are excluded. Browser autosave resumes local games.",
  };
}
export function replay(
  seed: number,
  initialInitiative: Seat,
  actions: AcceptedAction[],
  privateSetup: PrivateSetup,
  config?: Partial<PlaytestConfig>,
) {
  let state = setup({
    seed,
    initiativeOverride: initialInitiative,
    privateSetup,
    config,
    rulesVersion: VERSION,
  });
  for (const a of actions) {
    const r = reduce(state, a.actor, a.action);
    if (!r.ok)
      throw new Error(
        "Invalid replay at revision " + state.revision + ": " + r.message,
      );
    state = r.state;
  }
  return state;
}
export function saveGame(state: State, actions: AcceptedAction[]): Save {
  return {
    formatVersion: 3,
    rulesVersion: VERSION,
    catalogueHash: CATALOGUE_HASH,
    seed: state.seed,
    initialInitiative: state.initialInitiative,
    privateSetup: state.privateSetup,
    config: state.config,
    actions,
    state,
  };
}
export function loadGame(raw: string): Save {
  const save = JSON.parse(raw) as Save;
  if (save.rulesVersion !== VERSION)
    throw new Error(
      "This save uses rules " +
        (save.rulesVersion ?? "unknown") +
        ". Rules " +
        VERSION +
        " uses stations, private hands and paid installation. Keep the old backup and start a new match.",
    );
  if (
    save.formatVersion !== 3 ||
    save.catalogueHash !== CATALOGUE_HASH ||
    !Array.isArray(save.actions)
  )
    throw new Error("Unsupported save format or catalogue.");
  const state = replay(
    save.seed,
    save.initialInitiative,
    save.actions,
    save.privateSetup,
    save.config,
  );
  if (canonical(state) !== canonical(save.state))
    throw new Error("Save validation failed: state does not match its replay.");
  return { ...save, state };
}
function partValue(s: PublicState, seat: Seat, id: string): number {
  const p = s.players[seat],
    d = PARTS[id],
    st = p.stations[d.station];
  if (
    st.core.definitionId === id ||
    st.enhancements.some((c) => c?.definitionId === id)
  )
    return -20;
  const estimate = structuredClone(s);
  estimate.players[seat].resources = { coal: 3, steam: 1, work: 0, gears: 0 };
  for (const st of STATIONS)
    estimate.players[seat].stations[st].operated = false;
  const before = productionPlan(estimate, seat, [true, true, true]);
  const target = estimate.players[seat].stations[d.station];
  if (d.kind === "core") target.core = { id: "estimate", definitionId: id };
  else
    target.enhancements[target.enhancements[0] ? 1 : 0] = {
      id: "estimate",
      definitionId: id,
    };
  const after = productionPlan(estimate, seat, [true, true, true]);
  const weights = { coal: 0.45, steam: 0.55, work: 0.8, gears: 1.6 };
  let value =
    RESOURCES.reduce(
      (n, k) => n + (after.after[k] - before.after[k]) * weights[k],
      0,
    ) *
      3 -
    d.price * 0.55;
  if (id === "flywheel") value += 1;
  if (id === "precision-press" && before.steps[1].generated.work! < 2)
    value += 2;
  if (id === "compound-piston") value += 1;
  const goal = s.objective?.selected;
  if (
    goal === "modernizer" &&
    d.kind === "core" &&
    PARTS[st.core.definitionId].starter
  )
    value += 2;
  if (goal === "steam-supplier" && d.station === "energy") value += 1;
  if (goal === "industrial-supplier" && d.station === "conversion") value += 1;
  if (
    goal === "synchronized-workshop" &&
    ["heat-recovery", "pressure-tank", "synchronizer", "batch-die"].includes(id)
  )
    value += 1;
  return value;
}
export function chooseBotAction(view: View): Action {
  const seat = view.activePlayer!;
  const s = "privateSetup" in view ? project(view, seat) : view;
  const actions = legalActions(s, seat),
    p = s.players[seat],
    hand = s.hand ?? [],
    choices = s.blindChoices ?? [];
  if (!s.setupComplete)
    return (
      actions.find(
        (a) =>
          a.type === "choose-objective" && a.objective === "guild-portfolio",
      ) ??
      actions.find((a) => a.type === "choose-objective") ?? { type: "concede" }
    );
  if (s.phase === "run") {
    let best: [boolean, boolean, boolean] = [true, true, true],
      score = -Infinity;
    for (let n = 7; n >= 0; n--) {
      const enabled: [boolean, boolean, boolean] = [
          !!(n & 4),
          !!(n & 2),
          !!(n & 1),
        ],
        r = productionPlan(s, seat, enabled);
      let v =
        r.after.gears * 1.3 +
        r.after.work * 0.65 +
        r.after.steam * 0.4 +
        r.after.coal * 0.15;
      const delivery = Math.max(
        0,
        ...s.orders.map((c) => {
          const order = ORDERS[c.definitionId];
          const shortage = Object.values(
            missingCost(r.after, order.cost),
          ).reduce((sum, n) => sum + n, 0);
          return order.prestige * 2.2 - shortage * 1.4;
        }),
      );
      v += delivery;
      if (
        s.objective?.selected === "reserve-planner" &&
        Math.max(p.prestige, s.players[other(seat)].prestige) >=
          s.config.targetPrestige - 5
      )
        v += r.after.steam >= 4 && r.after.work >= 4 ? 5 : 0;
      if (
        s.objective?.selected === "synchronized-workshop" &&
        r.conditionalBenefit
      )
        v += 1;
      if (v > score) {
        score = v;
        best = enabled;
      }
    }
    return STATIONS.some((st, i) => p.stations[st].enabled !== best[i])
      ? { type: "set-stations", enabled: best }
      : { type: "produce" };
  }
  const ranked = actions
    .filter((a) => a.type !== "concede")
    .map((a) => {
      let score = -100;
      if (a.type === "pass") score = 0;
      if (a.type === "choose-objective") score = 2;
      if (a.type === "acquire-market" || a.type === "keep-blind") {
        const c = (a.type === "acquire-market" ? s.market : choices).find(
          (c) => c.id === a.instance,
        )!;
        score = partValue(s, seat, c.definitionId) + 5;
        if (a.discard) {
          const discard = [...hand, c].find((c) => c.id === a.discard)!;
          score -= partValue(s, seat, discard.definitionId) + 5;
        }
        if (a.type === "keep-blind") score += 100;
      }
      if (a.type === "draw-blind") score = 1;
      if (a.type === "install") {
        const d = PARTS[hand.find((c) => c.id === a.instance)!.definitionId];
        score = partValue(s, seat, d.id);
        if (
          s.round > 7 ||
          Math.max(p.prestige, s.players[other(seat)].prestige) >=
            s.config.targetPrestige - 4
        )
          score -= 4;
        if (
          d.kind === "enhancement" &&
          p.stations[d.station].enhancements[a.slot!]
        )
          score -= 2;
      }
      if (a.type === "take-coal") score = p.resources.coal < 4 ? 5 : 0.2;
      if (a.type === "deliver") {
        const d =
          ORDERS[s.orders.find((c) => c.id === a.commission)!.definitionId];
        score = d.prestige * 3 - (d.cost.gears ?? 0) * 0.7;
        if (
          s.objective?.selected === "guild-portfolio" &&
          !p.delivered.includes(d.id)
        )
          score += 3;
        if (s.objective?.selected === "steam-supplier" && d.cost.steam)
          score += 3;
        if (s.objective?.selected === "industrial-supplier" && d.cost.work)
          score += 3;
        if (p.prestige + d.prestige >= s.config.targetPrestige) score += 30;
      }
      return { a, score };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.a ?? { type: "concede" };
}
