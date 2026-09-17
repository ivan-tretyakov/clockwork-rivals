/** Proposed contracts only. This file contains no game implementation. */
export type PlayerId = 'P0' | 'P1';
export type GameId = 'clockwork-rivals' | 'living-frontier';
export type InstanceId = string;
export type DefinitionId = string;
export type TileId = 'H0' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
export type Terrain = 'meadow' | 'wetland' | 'woodland';
export type Resource = 'coal' | 'steam' | 'work' | 'gears';
export type GridSlot = { row: number; column: number };

export type ClockworkAction =
  | { type: 'draft-install'; marketInstance: InstanceId; slot: GridSlot; replace?: InstanceId }
  | { type: 'reconfigure'; from: GridSlot; to: GridSlot }
  | { type: 'take-coal'; useValve: boolean }
  | { type: 'activate'; instance: InstanceId }
  | { type: 'produce' }
  | { type: 'set-plan'; plan: { instance: InstanceId; enabled: boolean }[] }
  | { type: 'choose-objective'; objective: DefinitionId }
  | { type: 'deliver'; commission: InstanceId }
  | { type: 'pass' }
  | { type: 'concede' };

export type FrontierAction =
  | { type: 'draft'; marketInstance: InstanceId; discardReserve?: InstanceId }
  | { type: 'plant'; instance: InstanceId; tile: TileId; useMoss: boolean; replace?: InstanceId }
  | { type: 'install-support'; instance: InstanceId; replace?: InstanceId }
  | { type: 'basic-move'; organism: InstanceId; to: TileId }
  | { type: 'play-adaptation'; instance: InstanceId; target: { tile: TileId } | { organism: InstanceId; to: TileId } }
  | { type: 'pass' }
  | { type: 'concede' };

/** No client-supplied actor. Server binds actor from authenticated seat. */
export interface CommandEnvelope<A> {
  matchId: string;
  commandId: string;
  expectedRevision: number;
  rulesVersion: string;
  action: A;
}

export interface GameEvent {
  type: string;
  actor?: PlayerId;
  data: Record<string, unknown>;
}

export interface StateMeta {
  game: GameId;
  rulesVersion: string;
  revision: number;
  round: number;
  phase: string;
  initiative: PlayerId;
  activePlayer: PlayerId | null;
  status: 'active' | 'finished';
  winner: PlayerId | 'draw' | null;
}

export type RuleError =
  | 'MATCH_FINISHED' | 'WRONG_TURN' | 'WRONG_PHASE' | 'UNKNOWN_INSTANCE'
  | 'NOT_OWNER' | 'INSUFFICIENT_RESOURCES' | 'ILLEGAL_TARGET'
  | 'CAPACITY_EXCEEDED' | 'ALREADY_USED' | 'ACTION_LIMIT' | 'INVALID_ACTION';

export type ReduceResult<S> =
  | { ok: true; state: S; events: GameEvent[] }
  | { ok: false; state: S; error: RuleError; message: string };

export interface SetupOptions {
  seed: number;
  rulesVersion: string;
  /** Used by agreed rematches to alternate the initial player. */
  initiativeOverride?: PlayerId;
  config?: Partial<PlaytestConfig>;
}
export interface PlaytestConfig {
  objectives: 'choice' | 'random' | 'off';
  commissions: 'classic' | 'mixed';
  objectiveBonus: number;
  targetPrestige: number;
  maxRounds: number;
  sharedCoal: number;
}

export interface GameModule<S extends StateMeta, A, PublicView> {
  setup(options: SetupOptions): S;
  legalActions(state: S, actor: PlayerId): A[];
  reduce(state: S, actor: PlayerId, action: A): ReduceResult<S>;
  /** Must remove future deck order, seed/PRNG state and private session data. */
  project(state: S, viewer: PlayerId | 'spectator'): PublicView;
}

export interface CardInstance {
  id: InstanceId;
  definitionId: DefinitionId;
}

export interface Snapshot<S> {
  formatVersion: 1;
  rulesVersion: string;
  catalogueHash: string;
  seed: number;
  initialInitiative: PlayerId;
  state: S;
}

/** A future reducer should be implemented and tested in its own rules package. */
