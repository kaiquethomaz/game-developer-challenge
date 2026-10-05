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

export const DIFFICULTIES = ['calm', 'open', 'kraken'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}

export interface PlayerOptions {
  readonly matchDurationSeconds: number;
  readonly spawnIntervalSeconds: number;
  readonly difficulty: Difficulty;
}

export interface DifficultyPreset {
  readonly label: string;
  readonly description: string;
  readonly maxAlive: MatchRamp<number>;
  readonly distribution: MatchRamp<EnemyDistribution>;
  readonly enemyDamageScale: number;
  readonly salvageChanceScale: number;
}

export interface NumericLimit {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

type NumericOption = Exclude<keyof PlayerOptions, 'difficulty'>;

export const OPTION_LIMITS = {
  matchDurationSeconds: { min: 60, max: 180, step: 1 },
  spawnIntervalSeconds: { min: 1, max: 10, step: 0.5 },
} as const satisfies Record<NumericOption, NumericLimit>;

export const DEFAULT_PLAYER_OPTIONS: PlayerOptions = {
  matchDurationSeconds: 120,
  spawnIntervalSeconds: 3,
  difficulty: 'open',
};

const OPEN_SEA_MAX_ALIVE: MatchRamp<number> = { start: 4, end: 10 };
const OPEN_SEA_DISTRIBUTION: MatchRamp<EnemyDistribution> = {
  start: { chaser: 0.6, shooter: 0.4 },
  end: { chaser: 0.4, shooter: 0.6 },
};

export const DIFFICULTY_PRESETS: Readonly<Record<Difficulty, DifficultyPreset>> = {
  calm: {
    label: 'Calm Waters',
    description: 'Fewer ships at once, gentler cannons and more salvage.',
    maxAlive: { start: 3, end: 6 },
    distribution: {
      start: { chaser: 0.7, shooter: 0.3 },
      end: { chaser: 0.55, shooter: 0.45 },
    },
    enemyDamageScale: 0.75,
    salvageChanceScale: 1.4,
  },
  open: {
    label: 'Open Sea',
    description: 'The standard battle: pressure builds steadily as the clock runs.',
    maxAlive: OPEN_SEA_MAX_ALIVE,
    distribution: OPEN_SEA_DISTRIBUTION,
    enemyDamageScale: 1,
    salvageChanceScale: 1,
  },
  kraken: {
    label: "Kraken's Wrath",
    description: 'Crowded waters, more shooters and heavier hits.',
    maxAlive: { start: 6, end: 14 },
    distribution: {
      start: { chaser: 0.5, shooter: 0.5 },
      end: { chaser: 0.3, shooter: 0.7 },
    },
    enemyDamageScale: 1.3,
    salvageChanceScale: 0.8,
  },
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
    maxAlive: OPEN_SEA_MAX_ALIVE,
    minDistanceFromPlayer: 520,
    clearance: 8,
    candidateAttempts: 48,
    distribution: OPEN_SEA_DISTRIBUTION,
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

export function clampOption(key: NumericOption, value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PLAYER_OPTIONS[key];
  const { min, max } = OPTION_LIMITS[key];
  return Math.min(max, Math.max(min, value));
}

export function createMatchConfig(
  options: PlayerOptions,
  base: GameConfig = DEFAULT_GAME_CONFIG,
): GameConfig {
  const preset = DIFFICULTY_PRESETS[options.difficulty];
  const scaleDamage = (damage: number) => Math.round(damage * preset.enemyDamageScale);
  const scaleChance = (chance: number) => Math.min(1, chance * preset.salvageChanceScale);
  return {
    ...base,
    matchDurationSeconds: clampOption('matchDurationSeconds', options.matchDurationSeconds),
    spawn: {
      ...base.spawn,
      intervalSeconds: clampOption('spawnIntervalSeconds', options.spawnIntervalSeconds),
      maxAlive: preset.maxAlive,
      distribution: preset.distribution,
    },
    chaser: { ...base.chaser, contactDamage: scaleDamage(base.chaser.contactDamage) },
    shooter: {
      ...base.shooter,
      cannon: { ...base.shooter.cannon, damage: scaleDamage(base.shooter.cannon.damage) },
    },
    salvage: {
      ...base.salvage,
      dropChance: scaleChance(base.salvage.dropChance),
      lowHealthDropChance: scaleChance(base.salvage.lowHealthDropChance),
    },
  };
}
