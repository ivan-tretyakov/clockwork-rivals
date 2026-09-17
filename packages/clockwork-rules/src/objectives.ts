import type { Reserve, Player } from "./index";
export const OBJECTIVES = {
  "steam-reserve": {
    title: "Steam Reserve",
    symbol: "♨",
    description:
      "Finish with at least 4 steam, after producing at least 10 steam during the match.",
  },
  "work-reserve": {
    title: "Industrial Reserve",
    symbol: "⚒",
    description:
      "Finish with at least 4 work, after producing at least 8 work during the match.",
  },
  "versatile-workshop": {
    title: "Versatile Workshop",
    symbol: "⚙",
    description:
      "Successfully run at least 5 different active machine types during the match.",
  },
  "productive-shift": {
    title: "Productive Shift",
    symbol: "✦",
    description:
      "Gain at least 4 net gears in a single production. Recycling reduces the net gain.",
  },
  "independent-shifts": {
    title: "Independent Shifts",
    symbol: "◇",
    description:
      "In 2 different rounds, take no coal in Power and gain at least 2 net gears in production. Recycler coal is allowed.",
  },
  "guild-portfolio": {
    title: "Guild Portfolio",
    symbol: "♜",
    description:
      "Deliver at least 3 different commission types during the match.",
  },
} as const;
export type ObjectiveId = keyof typeof OBJECTIVES;
export interface ObjectiveMetrics {
  produced: Reserve;
  activatedTypes: string[];
  bestGearGain: number;
  independentRounds: number[];
  coalByRound: Record<number, number>;
}
export const emptyMetrics = (): ObjectiveMetrics => ({
  produced: { coal: 0, steam: 0, work: 0, gears: 0 },
  activatedTypes: [],
  bestGearGain: 0,
  independentRounds: [],
  coalByRound: {},
});
export function objectiveProgress(
  id: ObjectiveId,
  metrics: ObjectiveMetrics,
  player: Player,
) {
  switch (id) {
    case "steam-reserve":
      return {
        complete: player.resources.steam >= 4 && metrics.produced.steam >= 10,
        text: `${player.resources.steam}/4 steam held · ${metrics.produced.steam}/10 produced`,
      };
    case "work-reserve":
      return {
        complete: player.resources.work >= 4 && metrics.produced.work >= 8,
        text: `${player.resources.work}/4 work held · ${metrics.produced.work}/8 produced`,
      };
    case "versatile-workshop":
      return {
        complete: metrics.activatedTypes.length >= 5,
        text: `${metrics.activatedTypes.length}/5 machine types used`,
      };
    case "productive-shift":
      return {
        complete: metrics.bestGearGain >= 4,
        text: `${metrics.bestGearGain}/4 best net gear gain`,
      };
    case "independent-shifts":
      return {
        complete: metrics.independentRounds.length >= 2,
        text: `${metrics.independentRounds.length}/2 independent rounds`,
      };
    case "guild-portfolio": {
      const n = new Set(player.delivered).size;
      return { complete: n >= 3, text: `${n}/3 commission types delivered` };
    }
  }
}
