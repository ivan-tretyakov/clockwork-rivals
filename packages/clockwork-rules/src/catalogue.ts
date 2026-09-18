export const STATIONS = ["energy", "conversion", "fabrication"] as const;
export type Station = (typeof STATIONS)[number];
export const STATION_NAMES: Record<Station, string> = {
  energy: "Energy",
  conversion: "Conversion",
  fabrication: "Fabrication",
};
export type Resource = "coal" | "steam" | "work" | "gears";
export type Reserve = Record<Resource, number>;
export type Amounts = Partial<Reserve>;
export interface PartDefinition {
  id: string;
  name: string;
  station: Station;
  kind: "core" | "enhancement";
  price: number;
  starter?: boolean;
  input?: Amounts;
  output?: Amounts;
  effect?: string;
  text: string;
  art: string;
}
const core = (
  id: string,
  name: string,
  station: Station,
  price: number,
  input: Amounts,
  output: Amounts,
  art: string,
  starter = false,
): PartDefinition => ({
  id,
  name,
  station,
  price,
  input,
  output,
  art,
  starter,
  kind: "core",
  text: "Operates once when enabled and its full input is available.",
});
const enhancement = (
  id: string,
  name: string,
  station: Station,
  price: number,
  text: string,
): PartDefinition => ({
  id,
  name,
  station,
  price,
  text,
  kind: "enhancement",
  effect: id,
  art: id,
});
export const PARTS: Record<string, PartDefinition> = Object.fromEntries(
  [
    core(
      "basic-boiler",
      "Basic Boiler",
      "energy",
      0,
      { coal: 1 },
      { steam: 2 },
      "boiler",
      true,
    ),
    core(
      "basic-piston",
      "Basic Piston",
      "conversion",
      0,
      { steam: 1 },
      { work: 1 },
      "piston",
      true,
    ),
    core(
      "basic-press",
      "Basic Press",
      "fabrication",
      0,
      { work: 1 },
      { gears: 1 },
      "press",
      true,
    ),
    core(
      "recirculating-boiler",
      "Recirculating Boiler",
      "energy",
      3,
      { coal: 1 },
      { steam: 3 },
      "condenser",
    ),
    core(
      "industrial-boiler",
      "Industrial Boiler",
      "energy",
      4,
      { coal: 2 },
      { steam: 5 },
      "boiler",
    ),
    core(
      "compound-piston",
      "Compound Piston",
      "conversion",
      3,
      { steam: 1 },
      { work: 2 },
      "piston",
    ),
    core(
      "steam-turbine",
      "Steam Turbine",
      "conversion",
      4,
      { steam: 3 },
      { work: 4 },
      "turbine",
    ),
    core(
      "precision-press",
      "Precision Press",
      "fabrication",
      3,
      { work: 2 },
      { gears: 3 },
      "precision-press",
    ),
    core(
      "assembly-press",
      "Assembly Press",
      "fabrication",
      4,
      { work: 3 },
      { gears: 4 },
      "press",
    ),
    enhancement(
      "insulation",
      "Insulation Jacket",
      "energy",
      2,
      "Generate +1 steam.",
    ),
    enhancement(
      "heat-recovery",
      "Heat Recovery",
      "energy",
      2,
      "If the core pays at least 2 coal, return 1 coal after paying its full input.",
    ),
    enhancement(
      "pressure-tank",
      "Pressure Tank",
      "energy",
      3,
      "If steam was exactly 0 before Energy operates, generate +2 steam.",
    ),
    enhancement("flywheel", "Flywheel", "conversion", 2, "Generate +1 work."),
    enhancement(
      "steam-economizer",
      "Steam Economizer",
      "conversion",
      2,
      "Return 1 steam after paying the core’s full input.",
    ),
    enhancement(
      "synchronizer",
      "Synchronizer",
      "conversion",
      2,
      "If Energy generated at least 4 steam this production, generate +2 work.",
    ),
    enhancement(
      "gear-cutter",
      "Gear Cutter",
      "fabrication",
      3,
      "Generate +1 gear.",
    ),
    enhancement(
      "fine-tooling",
      "Fine Tooling",
      "fabrication",
      2,
      "Return 1 work after paying the core’s full input.",
    ),
    enhancement(
      "batch-die",
      "Batch Die",
      "fabrication",
      3,
      "If Conversion generated at least 3 work this production, generate +2 gears.",
    ),
  ].map((p) => [p.id, p]),
);
export interface CommissionDefinition {
  id: string;
  name: string;
  cost: Amounts;
  prestige: number;
}
export const ORDERS: Record<string, CommissionDefinition> = Object.fromEntries(
  [
    {
      id: "street-clock",
      name: "Street Clock",
      cost: { gears: 2 },
      prestige: 2,
    },
    { id: "clock-tower", name: "Clock Tower", cost: { gears: 3 }, prestige: 3 },
    { id: "observatory", name: "Observatory", cost: { gears: 5 }, prestige: 5 },
    {
      id: "district-heating",
      name: "District Heating",
      cost: { steam: 4, gears: 1 },
      prestige: 3,
    },
    {
      id: "factory-automata",
      name: "Factory Automata",
      cost: { work: 3, gears: 1 },
      prestige: 3,
    },
    {
      id: "transit-hub",
      name: "Transit Hub",
      cost: { steam: 2, work: 2, gears: 2 },
      prestige: 4,
    },
  ].map((c) => [c.id, c]),
);
export const OBJECTIVES = {
  "steam-supplier": {
    title: "Steam Supplier",
    symbol: "♨",
    description:
      "Deliver 3 commissions with steam in their printed cost. District Heating and Transit Hub count.",
  },
  "industrial-supplier": {
    title: "Industrial Supplier",
    symbol: "⚒",
    description:
      "Deliver 3 commissions with work in their printed cost. Factory Automata and Transit Hub count.",
  },
  "guild-portfolio": {
    title: "Guild Portfolio",
    symbol: "♜",
    description:
      "Deliver 3 different commission types. Repeated copies count once.",
  },
  modernizer: {
    title: "Modernizer",
    symbol: "⚙",
    description:
      "Operate a purchased replacement core in all 3 stations, in the same or different rounds.",
  },
  "synchronized-workshop": {
    title: "Synchronized Workshop",
    symbol: "✦",
    description:
      "Benefit from Heat Recovery, Pressure Tank, Synchronizer or Batch Die in 3 different productions. Some conditional output or refund must fit in reserves.",
  },
  "reserve-planner": {
    title: "Reserve Planner",
    symbol: "◇",
    description:
      "Finish with at least 4 steam and 4 work, after the final Delivery.",
  },
} as const;
export type ObjectiveId = keyof typeof OBJECTIVES;
