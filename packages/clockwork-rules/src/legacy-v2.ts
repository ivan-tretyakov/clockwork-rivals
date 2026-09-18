import {
  OBJECTIVES,
  emptyMetrics,
  objectiveProgress,
  type ObjectiveId,
  type ObjectiveMetrics,
} from "./legacy-objectives-v2";
export { OBJECTIVES, objectiveProgress };
import type { PlaytestConfig } from "../../../contracts/legacy-v2";
export type { PlaytestConfig };
import catalogue from "../../../data/clockwork-rivals.json";
import type {
  ClockworkAction,
  PlayerId,
  Resource,
  GridSlot,
  SetupOptions,
  GameModule,
  RuleError,
} from "../../../contracts/legacy-v2";
export type { ClockworkAction as Action, PlayerId as Seat, Resource };
export const VERSION = "0.2.0";
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
export interface CommissionDefinition {
  id: string;
  name: string;
  copies: number;
  cost: Amounts;
  prestige: number;
  art: string;
}
export const ORDERS: Record<string, CommissionDefinition> = Object.fromEntries([
  ...catalogue.commissions.map(
    (c) =>
      [
        c.id,
        {
          id: c.id,
          name: c.name,
          copies: c.copies,
          cost: { gears: c.gearCost },
          prestige: c.prestige,
          art: c.art,
        },
      ] as const,
  ),
  [
    "steamworks",
    {
      id: "steamworks",
      name: "Steamworks",
      copies: 3,
      cost: { steam: 3, gears: 1 },
      prestige: 3,
      art: "assets/ui/steam.svg",
    },
  ],
  [
    "automated-foundry",
    {
      id: "automated-foundry",
      name: "Automated Foundry",
      copies: 3,
      cost: { work: 2, gears: 1 },
      prestige: 3,
      art: "assets/ui/work.svg",
    },
  ],
]);
export const canAfford = (resources: Reserve, cost: Amounts) =>
  RESOURCES.every((r) => resources[r] >= (cost[r] ?? 0));
export const missingCost = (resources: Reserve, cost: Amounts): Amounts =>
  Object.fromEntries(
    RESOURCES.filter((r) => resources[r] < (cost[r] ?? 0)).map((r) => [
      r,
      (cost[r] ?? 0) - resources[r],
    ]),
  );
export const costText = (amounts: Amounts) =>
  RESOURCES.filter((r) => amounts[r])
    .map(
      (r) => `${amounts[r]} ${r === "gears" && amounts[r] === 1 ? "gear" : r}`,
    )
    .join(" + ");
export const LIMITS = catalogue.limits;
export const ALLOWANCE: Record<Phase, number> = {
  draft: LIMITS.draftActions,
  power: LIMITS.powerActions,
  run: 1,
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
export interface PlanEntry {
  instance: string;
  enabled: boolean;
}
export interface Player {
  productionOrder: PlanEntry[];
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
export const DEFAULT_CONFIG: PlaytestConfig = {
  objectives: "choice",
  commissions: "mixed",
  objectiveBonus: 2,
  targetPrestige: 10,
  maxRounds: 8,
  sharedCoal: 3,
};
export interface PrivateSetup {
  offers: Record<PlayerId, ObjectiveId[]>;
}
export function privateDeal(mode: PlaytestConfig["objectives"]): PrivateSetup {
  const ids = Object.keys(OBJECTIVES) as ObjectiveId[];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const n = mode === "choice" ? 2 : mode === "random" ? 1 : 0;
  return { offers: { P0: ids.slice(0, n), P1: ids.slice(n, n * 2) } };
}
export function gameConfig(
  input: Partial<PlaytestConfig> = {},
): PlaytestConfig {
  const c = { ...DEFAULT_CONFIG, ...input };
  if (
    !["choice", "random", "off"].includes(c.objectives) ||
    !["classic", "mixed"].includes(c.commissions) ||
    !Number.isInteger(c.objectiveBonus) ||
    c.objectiveBonus < 0 ||
    c.objectiveBonus > 5 ||
    !Number.isInteger(c.targetPrestige) ||
    c.targetPrestige < 6 ||
    c.targetPrestige > 20 ||
    !Number.isInteger(c.maxRounds) ||
    c.maxRounds < 4 ||
    c.maxRounds > 12 ||
    !Number.isInteger(c.sharedCoal) ||
    c.sharedCoal < 1 ||
    c.sharedCoal > 6
  )
    throw new Error("Invalid playtest configuration.");
  return c;
}
export interface ObjectiveView {
  offers: ObjectiveId[];
  selected: ObjectiveId | null;
  progress: { complete: boolean; text: string } | null;
}
export interface ObjectiveReveal {
  selected: ObjectiveId | null;
  complete: boolean;
  progress: string;
  bonus: number;
}
export interface State {
  config: PlaytestConfig;
  setupComplete: boolean;
  privateSetup: PrivateSetup;
  objectivesPrivate: Record<
    PlayerId,
    { selected: ObjectiveId | null; metrics: ObjectiveMetrics }
  >;
  objectiveReady: Record<PlayerId, boolean>;
  revealedObjectives: Record<PlayerId, ObjectiveReveal> | null;
  finalScores: Record<PlayerId, number> | null;
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
  | "seed"
  | "initialInitiative"
  | "partDeck"
  | "orderDeck"
  | "privateSetup"
  | "objectivesPrivate"
> & {
  partDeckCount: number;
  orderDeckCount: number;
  objective?: ObjectiveView;
};
export type View = State | PublicState;
export interface AcceptedAction {
  actor: PlayerId;
  action: ClockworkAction;
}
export interface Save {
  formatVersion: 2;
  privateSetup: PrivateSetup;
  config: PlaytestConfig;
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
export const CATALOGUE_HASH = hash(
  canonical({ catalogue, ORDERS, OBJECTIVES, VERSION }),
);
export function setup(
  options: SetupOptions & { privateSetup?: PrivateSetup },
): State {
  if (options.rulesVersion !== VERSION || !Number.isFinite(options.seed))
    throw new Error("Unsupported rules version or seed.");
  const config = gameConfig(options.config);
  const hidden = structuredClone(
    options.privateSetup ?? privateDeal(config.objectives),
  );
  const count =
    config.objectives === "choice" ? 2 : config.objectives === "random" ? 1 : 0;
  const candidates = [...hidden.offers.P0, ...hidden.offers.P1];
  if (
    hidden.offers.P0.length !== count ||
    hidden.offers.P1.length !== count ||
    new Set(candidates).size !== candidates.length ||
    candidates.some((id) => !OBJECTIVES[id])
  )
    throw new Error("Invalid private objective deal.");
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
      productionOrder: grid
        .filter(
          (c): c is Card =>
            !!c && PARTS[c.definitionId].effect.kind === "convert",
        )
        .map((c) => ({ instance: c.id, enabled: true })),
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
    Object.values(ORDERS)
      .filter(
        (c) =>
          config.commissions === "mixed" ||
          catalogue.commissions.some((original) => original.id === c.id),
      )
      .flatMap((c) =>
        Array.from({ length: c.copies }, (_, i) => ({
          id: `order-${c.id}-${i}`,
          definitionId: c.id,
        })),
      ),
    random,
  );
  return {
    config,
    privateSetup: hidden,
    objectivesPrivate: {
      P0: {
        selected: config.objectives === "random" ? hidden.offers.P0[0] : null,
        metrics: emptyMetrics(),
      },
      P1: {
        selected: config.objectives === "random" ? hidden.offers.P1[0] : null,
        metrics: emptyMetrics(),
      },
    },
    setupComplete: config.objectives !== "choice",
    objectiveReady: {
      P0: config.objectives !== "choice",
      P1: config.objectives !== "choice",
    },
    revealedObjectives: null,
    finalScores: null,
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
    sharedCoal: config.sharedCoal,
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
export interface ProductionStep {
  instance: string;
  definitionId: string;
  slot: number;
  effect: Preview;
}
export function normalizedPlan(state: View, actor: PlayerId): PlanEntry[] {
  const machines = state.players[actor].grid.filter(
    (c): c is Card => !!c && PARTS[c.definitionId].effect.kind === "convert",
  );
  const plan = (state.players[actor].productionOrder ?? []).filter((e) =>
    machines.some((c) => c.id === e.instance),
  );
  return [
    ...plan,
    ...machines
      .filter((c) => !plan.some((e) => e.instance === c.id))
      .map((c) => ({ instance: c.id, enabled: true })),
  ];
}
export function validPlan(
  state: View,
  actor: PlayerId,
  plan: unknown,
): plan is PlanEntry[] {
  const expected = normalizedPlan(state, actor);
  return (
    Array.isArray(plan) &&
    plan.length === expected.length &&
    new Set(plan.map((e) => e?.instance)).size === plan.length &&
    plan.every(
      (e) =>
        e &&
        typeof e.enabled === "boolean" &&
        Object.keys(e).length === 2 &&
        expected.some((c) => c.instance === e.instance),
    )
  );
}
export function adjacencyInfo(state: View, actor: PlayerId, instance: string) {
  const grid = state.players[actor].grid;
  const index = grid.findIndex((c) => c?.id === instance);
  const card = grid[index];
  if (!card) return { targets: [] as number[], text: "No machine" };
  const effect = PARTS[card.definitionId].effect;
  const target =
    card.definitionId === "condenser"
      ? "boiler"
      : card.definitionId === "boiler"
        ? "condenser"
        : effect.adjacencyBonus?.friendlyDefinition;
  const targets = target
    ? neighbors(index).filter((n) => grid[n]?.definitionId === target)
    : [];
  return {
    targets,
    text: target
      ? targets.length
        ? `Bonus active · adjacent ${PARTS[target].name}${targets.length > 1 ? "s" : ""}`
        : `Bonus inactive · needs an adjacent ${PARTS[target].name}`
      : card.definitionId === "priority-valve"
        ? "Power bonus · no adjacency needed"
        : "No adjacency requirement · resources are shared across your workshop",
  };
}
export function installationPreview(
  state: View,
  actor: PlayerId,
  marketInstance: string,
  target: number,
) {
  const card = state.market.find((c) => c.id === marketInstance);
  if (
    !card ||
    target < 0 ||
    target > 8 ||
    !Number.isInteger(target) ||
    (state.players[actor].grid[target] &&
      !state.players[actor].grid.every(Boolean))
  )
    return null;
  const next = structuredClone(state);
  next.players[actor].grid[target] = structuredClone(card);
  next.players[actor].productionOrder = normalizedPlan(next, actor);
  const linked = adjacencyInfo(next, actor, card.id);
  const affected = next.players[actor].grid
    .filter((c): c is Card => !!c)
    .filter(
      (c) =>
        c.id === card.id ||
        canonical(adjacencyInfo(state, actor, c.id)) !==
          canonical(adjacencyInfo(next, actor, c.id)),
    )
    .map((c) => ({
      name: PARTS[c.definitionId].name,
      ...adjacencyInfo(next, actor, c.id),
    }));
  return {
    before: productionPlan(state, actor),
    after: productionPlan(next, actor),
    grid: next.players[actor].grid,
    linked: linked.targets,
    affected,
  };
}
// The same pure resolver drives the preview and authoritative production.
export function productionPlan(
  state: View,
  actor: PlayerId,
  plan = normalizedPlan(state, actor),
) {
  const working = structuredClone(state);
  const player = working.players[actor];
  const steps: ProductionStep[] = [];
  while (true) {
    const next = plan.find((entry) => {
      const card = player.grid.find((c) => c?.id === entry.instance);
      return (
        entry.enabled &&
        card &&
        !card.exhausted &&
        preview(working, actor, card.id)?.affordable
      );
    });
    if (!next) break;
    const index = player.grid.findIndex((c) => c?.id === next.instance);
    const card = player.grid[index]!;
    const effect = preview(working, actor, card.id)!;
    steps.push({
      instance: card.id,
      definitionId: card.definitionId,
      slot: index,
      effect,
    });
    player.resources = effect.after;
    card.exhausted = true;
    if (effect.condenser !== null)
      player.grid[effect.condenser]!.boosted = true;
  }
  const skipped = plan
    .filter((e) => !steps.some((step) => step.instance === e.instance))
    .map((entry) => {
      const card = player.grid.find((c) => c?.id === entry.instance)!;
      const effect = preview(working, actor, card.id)!;
      const missing = RESOURCES.filter(
        (r) => player.resources[r] < (effect.input[r] ?? 0),
      )
        .map((r) => `${(effect.input[r] ?? 0) - player.resources[r]} ${r}`)
        .join(", ");
      return {
        ...card,
        reason: !entry.enabled
          ? "Disabled by your plan"
          : card.exhausted
            ? "Already used this round"
            : `Needs ${missing}`,
      };
    });
  return { steps, after: player.resources, grid: player.grid, skipped };
}
export function legalActions(state: View, actor: PlayerId): ClockworkAction[] {
  if (state.status !== "active" || state.activePlayer !== actor) return [];
  if (!state.setupComplete) {
    const offers =
      "privateSetup" in state
        ? state.privateSetup.offers[actor]
        : (state.objective?.offers ?? []);
    return offers.map((objective) => ({ type: "choose-objective", objective }));
  }
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
    actions.push({ type: "produce" });
  } else if (state.phase === "deliver") {
    for (const c of state.orders)
      if (canAfford(p.resources, ORDERS[c.definitionId].cost))
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
    !(
      action.type === "set-plan" &&
      state.setupComplete &&
      state.phase === "run" &&
      validPlan(state, actor, action.plan)
    ) &&
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
  if (action.type === "set-plan") {
    p.productionOrder = structuredClone(action.plan);
    return { ok: true as const, state: s, events: [] as Event[] };
  }
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
    case "choose-objective": {
      s.objectivesPrivate[actor].selected = action.objective as ObjectiveId;
      s.objectiveReady[actor] = true;
      s.setupComplete = s.objectiveReady.P0 && s.objectiveReady.P1;
      s.activePlayer = s.setupComplete ? s.initialInitiative : other(actor);
      event(
        "objective-ready",
        `${names[actor]} locks a private objective.`,
        {},
        actor,
      );
      if (s.setupComplete)
        event("setup", "Both objectives are locked. Round one begins.");
      return { ok: true as const, state: s, events };
    }
    case "concede":
      s.status = "finished";
      s.winner = other(actor);
      scoreObjectives(s, true);
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
      p.productionOrder = normalizedPlan(s, actor);
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
      s.objectivesPrivate[actor].metrics.coalByRound[s.round] =
        (s.objectivesPrivate[actor].metrics.coalByRound[s.round] ?? 0) + amount;
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
    case "produce": {
      const plan = productionPlan(s, actor);
      const before = { ...p.resources };
      for (const step of plan.steps) {
        const effect = step.effect;
        const metrics = s.objectivesPrivate[actor].metrics;
        if (!metrics.activatedTypes.includes(step.definitionId))
          metrics.activatedTypes.push(step.definitionId);
        for (const r of RESOURCES)
          metrics.produced[r] += Math.max(
            0,
            (effect.output[r] ?? 0) - (effect.overflow[r] ?? 0),
          );
        event(
          "activate",
          `${names[actor]} runs ${PARTS[step.definitionId].name}: ${amounts(effect.input)} → ${amounts(effect.output)}${effect.adjacent.length ? " (adjacency bonus)" : ""}.`,
          {
            instance: step.instance,
            input: effect.input,
            output: effect.output,
            adjacent: effect.adjacent,
          },
          actor,
        );
        for (const r of RESOURCES)
          if (effect.overflow[r])
            event(
              "overflow",
              `${names[actor]} loses ${effect.overflow[r]} ${r} above the reserve cap.`,
              { resource: r, amount: effect.overflow[r] },
              actor,
            );
      }
      p.resources = plan.after;
      p.grid = plan.grid;
      const metrics = s.objectivesPrivate[actor].metrics;
      const netGears = p.resources.gears - before.gears;
      metrics.bestGearGain = Math.max(metrics.bestGearGain, netGears);
      if (
        netGears >= 2 &&
        !metrics.coalByRound[s.round] &&
        !metrics.independentRounds.includes(s.round)
      )
        metrics.independentRounds.push(s.round);
      s.passed[actor] = true;
      event(
        "produce",
        `${names[actor]} finishes production: ${plan.steps.length} machines ran, ${p.resources.gears} gears ready for Delivery.`,
        {
          sequence: plan.steps.map((step) => step.definitionId),
          before,
          after: { ...p.resources },
          skipped: plan.skipped.map((card) => card.id),
        },
        actor,
      );
      break;
    }
    case "deliver": {
      const i = s.orders.findIndex((c) => c.id === action.commission);
      const [card] = s.orders.splice(i, 1);
      const order = ORDERS[card.definitionId];
      for (const r of RESOURCES) p.resources[r] -= order.cost[r] ?? 0;
      p.prestige += order.prestige;
      p.delivered.push(card.definitionId);
      s.discarded.push(card);
      event(
        "deliver",
        `${names[actor]} delivers ${order.name} for ${order.prestige} prestige.`,
        { commission: card.id, cost: order.cost, prestige: order.prestige },
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
        s.round >= s.config.maxRounds ||
        s.players.P0.prestige >= s.config.targetPrestige ||
        s.players.P1.prestige >= s.config.targetPrestige
      ) {
        scoreObjectives(s);
        const a = s.players.P0,
          b = s.players.P1;
        const difference =
          s.finalScores!.P0 - s.finalScores!.P1 ||
          a.resources.gears - b.resources.gears;
        s.winner = difference > 0 ? "P0" : difference < 0 ? "P1" : "draw";
        s.status = "finished";
        s.activePlayer = null;
        event(
          "finish",
          s.winner === "draw"
            ? "A perfect tie. Both workshops share the honors."
            : `${names[s.winner]} wins with ${s.finalScores![s.winner]} final prestige (including private objectives).`,
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
      s.sharedCoal = s.config.sharedCoal;
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
        `Round ${s.round}. ${names[s.initiative]} has initiative. Coal refilled to ${s.config.sharedCoal}.`,
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
export function scoreObjectives(s: State, concession = false) {
  const reveal = {} as Record<PlayerId, ObjectiveReveal>;
  const scores = {} as Record<PlayerId, number>;
  for (const seat of ["P0", "P1"] as const) {
    const own = s.objectivesPrivate[seat];
    const progress = own.selected
      ? objectiveProgress(own.selected, own.metrics, s.players[seat])
      : { complete: false, text: "No objective" };
    const bonus =
      !concession && progress.complete ? s.config.objectiveBonus : 0;
    reveal[seat] = {
      selected: own.selected,
      complete: progress.complete,
      progress: progress.text,
      bonus,
    };
    scores[seat] = s.players[seat].prestige + bonus;
  }
  s.revealedObjectives = reveal;
  s.finalScores = scores;
}
export function project(
  s: State,
  viewer: PlayerId | "spectator" = "spectator",
): PublicState {
  const {
    seed: _seed,
    initialInitiative: _initiative,
    partDeck,
    orderDeck,
    privateSetup,
    objectivesPrivate,
    ...rest
  } = s;
  const own = viewer === "spectator" ? null : objectivesPrivate[viewer];
  return structuredClone({
    ...rest,
    partDeckCount: partDeck.length,
    orderDeckCount: orderDeck.length,
    ...(own && viewer !== "spectator" && s.status !== "finished"
      ? {
          objective: {
            offers: own.selected ? [] : privateSetup.offers[viewer],
            selected: own.selected,
            progress: own.selected
              ? objectiveProgress(own.selected, own.metrics, s.players[viewer])
              : null,
          },
        }
      : {}),
  });
}
export function publicReport(s: State | PublicState) {
  const view =
    "privateSetup" in s ? project(s) : (({ objective: _, ...rest }) => rest)(s);
  return {
    kind: "clockwork-public-report",
    rulesVersion: VERSION,
    state: view,
    note: "Public report only. Private cards, offers, objective choices and private metrics are excluded. Local play resumes from this browser's autosave.",
  };
}
export function replay(
  seed: number,
  initialInitiative: PlayerId,
  actions: AcceptedAction[],
  privateSetup?: PrivateSetup,
  config?: Partial<PlaytestConfig>,
): State {
  let state = setup({
    seed,
    rulesVersion: VERSION,
    initiativeOverride: initialInitiative,
    privateSetup,
    config,
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
    formatVersion: 2,
    privateSetup: state.privateSetup,
    config: state.config,
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
  if (save.rulesVersion !== VERSION)
    throw new Error(
      `This save uses rules ${save.rulesVersion ?? "unknown"}. Version ${VERSION} adds production plans and private objectives. Keep your old backup and start a new match.`,
    );
  if (
    save.formatVersion !== 2 ||
    save.rulesVersion !== VERSION ||
    save.catalogueHash !== CATALOGUE_HASH ||
    !Array.isArray(save.actions) ||
    save.actions.length > 1000
  )
    throw new Error("This save uses an unsupported rules catalogue or format.");
  const state = replay(
    save.seed,
    save.initialInitiative,
    save.actions,
    save.privateSetup,
    save.config,
  );
  if (canonical(state) !== canonical(save.state))
    throw new Error(
      "Save validation failed. The snapshot does not match its replay.",
    );
  return { ...save, state };
}
export function chooseBotAction(s: View): ClockworkAction {
  if ("privateSetup" in s) s = project(s, s.activePlayer!);
  const seat = s.activePlayer!;
  const p = s.players[seat];
  const goal = "objective" in s ? s.objective?.selected : null;
  if (s.setupComplete && s.phase === "run") {
    const priority = [
      "precision-press",
      "flywheel",
      "piston",
      "press",
      "boiler",
      "hand-crank",
      "turbine",
      "recycler",
    ];
    const plan = normalizedPlan(s, seat)
      .map((entry) => {
        const id = p.grid.find((c) => c?.id === entry.instance)!.definitionId;
        let enabled = true;
        if (id === "recycler")
          enabled =
            goal === "versatile-workshop" ||
            (p.resources.coal === 0 && p.resources.gears >= 3);
        if (
          s.round >= 3 &&
          goal === "steam-reserve" &&
          ["piston", "flywheel", "turbine"].includes(id)
        )
          enabled = false;
        if (
          s.round >= 3 &&
          goal === "work-reserve" &&
          ["press", "precision-press"].includes(id)
        )
          enabled = false;
        return { ...entry, enabled };
      })
      .sort(
        (a, b) =>
          priority.indexOf(
            p.grid.find((c) => c?.id === a.instance)!.definitionId,
          ) -
          priority.indexOf(
            p.grid.find((c) => c?.id === b.instance)!.definitionId,
          ),
      );
    if (canonical(plan) !== canonical(normalizedPlan(s, seat)))
      return { type: "set-plan", plan };
  }
  const actions = legalActions(s, seat);
  const value = (a: ClockworkAction) => {
    if (a.type === "choose-objective")
      return a.objective === "productive-shift" ? 10 : 5;
    if (a.type === "produce") return 1000;
    if (a.type === "pass") return -100;
    if (a.type === "reconfigure") return -50;
    if (a.type === "take-coal") return a.useValve ? 20 : 10;
    if (a.type === "deliver") {
      const order =
        ORDERS[s.orders.find((c) => c.id === a.commission)!.definitionId];
      return (
        order.prestige * 10 +
        (goal === "guild-portfolio" && !p.delivered.includes(order.id)
          ? 10
          : 0) -
        (goal === "steam-reserve"
          ? (order.cost.steam ?? 0) * 4
          : goal === "work-reserve"
            ? (order.cost.work ?? 0) * 4
            : 0)
      );
    }
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
