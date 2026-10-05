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
}

export interface ShipMovementConfig {
  readonly maxHealth: number;
  readonly radius: number;
  readonly maxSpeed: number;
  readonly acceleration: number;
  readonly deceleration: number;
  readonly turnSpeed: number;
}

export interface PlayerConfig extends ShipMovementConfig {
  readonly frontCannon: WeaponConfig;
  readonly broadside: BroadsideConfig;
}

export interface ChaserConfig extends ShipMovementConfig {
  readonly contactDamage: number;
}

export interface ShooterConfig extends ShipMovementConfig {
  readonly attackRange: number;
  readonly preferredRange: number;
  readonly aimToleranceRadians: number;
  readonly cannon: WeaponConfig;
}

export interface EnemyDistribution {
  readonly chaser: number;
  readonly shooter: number;
}

export interface SpawnConfig {
  readonly intervalSeconds: number;
  readonly initialDelaySeconds: number;
  readonly maxAlive: number;
  readonly minDistanceFromPlayer: number;
  readonly distribution: EnemyDistribution;
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
}

export interface GameConfig {
  readonly matchDurationSeconds: number;
  readonly fixedStepSeconds: number;
  readonly maxFrameSeconds: number;
  readonly arena: ArenaConfig;
  readonly spawn: SpawnConfig;
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
      { col: 4, row: 2, cols: 4, rows: 3 },
      { col: 19, row: 2, cols: 3, rows: 4 },
      { col: 12, row: 9, cols: 5, rows: 3 },
      { col: 24, row: 10, cols: 3, rows: 3 },
      { col: 3, row: 11, cols: 3, rows: 3 },
    ],
    playerStart: { x: 9 * TILE_SIZE, y: 7.5 * TILE_SIZE, heading: 0 },
  },
  spawn: {
    intervalSeconds: DEFAULT_PLAYER_OPTIONS.spawnIntervalSeconds,
    initialDelaySeconds: 1.5,
    maxAlive: 12,
    minDistanceFromPlayer: 520,
    distribution: { chaser: 0.55, shooter: 0.45 },
  },
  navigation: {
    refreshIntervalSeconds: 0.25,
  },
  player: {
    maxHealth: 100,
    radius: 26,
    maxSpeed: 190,
    acceleration: 260,
    deceleration: 200,
    turnSpeed: 2.6,
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
    },
  },
  chaser: {
    maxHealth: 40,
    radius: 22,
    maxSpeed: 150,
    acceleration: 220,
    deceleration: 200,
    turnSpeed: 2.2,
    contactDamage: 20,
  },
  shooter: {
    maxHealth: 60,
    radius: 26,
    maxSpeed: 110,
    acceleration: 160,
    deceleration: 180,
    turnSpeed: 1.8,
    attackRange: 420,
    preferredRange: 300,
    aimToleranceRadians: 0.2,
    cannon: {
      cooldownSeconds: 1.6,
      damage: 10,
      projectileSpeed: 420,
      projectileRange: 460,
      projectileLifetimeSeconds: 1.4,
      projectileRadius: 6,
    },
  },
};

export function clampOption(key: keyof PlayerOptions, value: number): number {
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
