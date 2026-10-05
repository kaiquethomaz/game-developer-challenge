export interface TileRect {
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
}

export interface WeaponConfig {
  readonly cooldownSeconds: number;
  readonly damage: number;
  readonly projectileSpeed: number;
  readonly projectileRange: number;
  readonly projectileLifetimeSeconds: number;
  readonly projectileRadius: number;
}

export interface BroadsideConfig extends WeaponConfig {
  readonly projectileCount: number;
  readonly spacing: number;
  readonly sideOffsetRatio: number;
}

export interface VolleyConfig extends WeaponConfig {
  readonly projectileCount: number;
  readonly spreadRadians: number;
}

export interface ShipMovementConfig {
  readonly maxHealth: number;
  readonly radius: number;
  readonly maxSpeed: number;
  readonly acceleration: number;
  readonly deceleration: number;
  readonly turnSpeed: number;
  readonly collisionSpeedFactor: number;
}

export interface EnemySteeringConfig extends ShipMovementConfig {
  readonly sharpTurnRadians: number;
  readonly sharpTurnThrottle: number;
}

export interface PlayerConfig extends ShipMovementConfig {
  readonly frontCannon: WeaponConfig;
  readonly broadside: BroadsideConfig;
  readonly volley: VolleyConfig;
}

export interface ChaserConfig extends EnemySteeringConfig {
  readonly contactDamage: number;
}

export interface ShooterConfig extends EnemySteeringConfig {
  readonly attackRange: number;
  readonly preferredRange: number;
  readonly minApproachThrottle: number;
  readonly lineOfSightRadius: number;
  readonly aimToleranceRadians: number;
  readonly cannon: WeaponConfig;
}

export interface EnemyDistribution {
  readonly chaser: number;
  readonly shooter: number;
}

export interface MatchRamp<T> {
  readonly start: T;
  readonly end: T;
}

export interface SpawnConfig {
  readonly intervalSeconds: number;
  readonly initialDelaySeconds: number;
  readonly maxAlive: MatchRamp<number>;
  readonly minDistanceFromPlayer: number;
  readonly clearance: number;
  readonly candidateAttempts: number;
  readonly distribution: MatchRamp<EnemyDistribution>;
}

export interface SalvageConfig {
  readonly dropChance: number;
  readonly lowHealthDropChance: number;
  readonly lowHealthRatio: number;
  readonly repairAmount: number;
  readonly radius: number;
  readonly lifetimeSeconds: number;
  readonly maxActive: number;
}

export interface ArenaConfig {
  readonly tileSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly islands: readonly TileRect[];
  readonly playerStart: { readonly x: number; readonly y: number; readonly heading: number };
}

export interface NavigationConfig {
  readonly refreshIntervalSeconds: number;
  readonly clearanceMargin: number;
}

export interface GameConfig {
  readonly matchDurationSeconds: number;
  readonly fixedStepSeconds: number;
  readonly maxFrameSeconds: number;
  readonly arena: ArenaConfig;
  readonly spawn: SpawnConfig;
  readonly salvage: SalvageConfig;
  readonly navigation: NavigationConfig;
  readonly player: PlayerConfig;
  readonly chaser: ChaserConfig;
  readonly shooter: ShooterConfig;
}

export interface PlayerOptions {
  readonly matchDurationSeconds: number;
  readonly spawnIntervalSeconds: number;
}

export interface NumericLimit {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export const OPTION_LIMITS = {
  matchDurationSeconds: { min: 60, max: 180, step: 1 },
  spawnIntervalSeconds: { min: 1, max: 10, step: 0.5 },
} as const satisfies Record<keyof PlayerOptions, NumericLimit>;

export const DEFAULT_PLAYER_OPTIONS: PlayerOptions = {
  matchDurationSeconds: 120,
  spawnIntervalSeconds: 3,
};

const TILE_SIZE = 64;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  matchDurationSeconds: DEFAULT_PLAYER_OPTIONS.matchDurationSeconds,
  fixedStepSeconds: 1 / 60,
  maxFrameSeconds: 0.25,
  arena: {
    tileSize: TILE_SIZE,
    cols: 30,
    rows: 17,
    islands: [
      { col: 3, row: 2, cols: 4, rows: 4 },
      { col: 19, row: 2, cols: 4, rows: 4 },
      { col: 13, row: 9, cols: 4, rows: 4 },
      { col: 24, row: 10, cols: 4, rows: 4 },
      { col: 3, row: 11, cols: 4, rows: 4 },
      { col: 26, row: 3, cols: 2, rows: 2 },
    ],
    playerStart: { x: 9 * TILE_SIZE, y: 7.5 * TILE_SIZE, heading: 0 },
  },
  spawn: {
    intervalSeconds: DEFAULT_PLAYER_OPTIONS.spawnIntervalSeconds,
    initialDelaySeconds: 1.5,
    maxAlive: { start: 4, end: 10 },
    minDistanceFromPlayer: 520,
    clearance: 8,
    candidateAttempts: 48,
    distribution: {
      start: { chaser: 0.6, shooter: 0.4 },
      end: { chaser: 0.4, shooter: 0.6 },
    },
  },
  salvage: {
    dropChance: 0.35,
    lowHealthDropChance: 0.7,
    lowHealthRatio: 0.5,
    repairAmount: 20,
    radius: 18,
    lifetimeSeconds: 12,
    maxActive: 3,
  },
  navigation: {
    refreshIntervalSeconds: 0.25,
    clearanceMargin: 2,
  },
  player: {
    maxHealth: 100,
    radius: 26,
    maxSpeed: 190,
    acceleration: 260,
    deceleration: 200,
    turnSpeed: 2.6,
    collisionSpeedFactor: 0.35,
    frontCannon: {
      cooldownSeconds: 0.45,
      damage: 25,
      projectileSpeed: 620,
      projectileRange: 560,
      projectileLifetimeSeconds: 1.2,
      projectileRadius: 6,
    },
    broadside: {
      cooldownSeconds: 1.2,
      damage: 20,
      projectileSpeed: 520,
      projectileRange: 380,
      projectileLifetimeSeconds: 1,
      projectileRadius: 6,
      projectileCount: 3,
      spacing: 22,
      sideOffsetRatio: 0.6,
    },
    volley: {
      cooldownSeconds: 6,
      damage: 25,
      projectileSpeed: 640,
      projectileRange: 520,
      projectileLifetimeSeconds: 1.1,
      projectileRadius: 7,
      projectileCount: 3,
      spreadRadians: 0.24,
    },
  },
  chaser: {
    maxHealth: 40,
    radius: 22,
    maxSpeed: 150,
    acceleration: 220,
    deceleration: 200,
    turnSpeed: 2.2,
    collisionSpeedFactor: 0.35,
    sharpTurnRadians: Math.PI / 2,
    sharpTurnThrottle: 0.4,
    contactDamage: 20,
  },
  shooter: {
    maxHealth: 60,
    radius: 26,
    maxSpeed: 110,
    acceleration: 160,
    deceleration: 180,
    turnSpeed: 1.8,
    collisionSpeedFactor: 0.35,
    sharpTurnRadians: Math.PI / 2,
    sharpTurnThrottle: 0.4,
    attackRange: 420,
    preferredRange: 300,
    minApproachThrottle: 0.35,
    lineOfSightRadius: 4,
    aimToleranceRadians: 0.2,
    cannon: {
      cooldownSeconds: 1.8,
      damage: 8,
      projectileSpeed: 420,
      projectileRange: 460,
      projectileLifetimeSeconds: 1.4,
      projectileRadius: 6,
    },
  },
};

export function clampOption(key: keyof PlayerOptions, value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PLAYER_OPTIONS[key];
  const { min, max } = OPTION_LIMITS[key];
  return Math.min(max, Math.max(min, value));
}

export function createMatchConfig(
  options: PlayerOptions,
  base: GameConfig = DEFAULT_GAME_CONFIG,
): GameConfig {
  return {
    ...base,
    matchDurationSeconds: clampOption('matchDurationSeconds', options.matchDurationSeconds),
    spawn: {
      ...base.spawn,
      intervalSeconds: clampOption('spawnIntervalSeconds', options.spawnIntervalSeconds),
    },
  };
}
