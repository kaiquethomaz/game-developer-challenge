import { describe, expect, it } from 'vitest';
import {
  clampOption,
  createMatchConfig,
  DEFAULT_GAME_CONFIG,
  DEFAULT_PLAYER_OPTIONS,
  DIFFICULTIES,
  OPTION_LIMITS,
} from './config';

describe('player options', () => {
  it('clamps values to the documented limits', () => {
    expect(clampOption('matchDurationSeconds', 10)).toBe(OPTION_LIMITS.matchDurationSeconds.min);
    expect(clampOption('matchDurationSeconds', 999)).toBe(OPTION_LIMITS.matchDurationSeconds.max);
    expect(clampOption('spawnIntervalSeconds', 0)).toBe(OPTION_LIMITS.spawnIntervalSeconds.min);
  });

  it('falls back to defaults for non-finite values', () => {
    expect(clampOption('matchDurationSeconds', Number.NaN)).toBe(
      DEFAULT_PLAYER_OPTIONS.matchDurationSeconds,
    );
    expect(clampOption('spawnIntervalSeconds', Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_PLAYER_OPTIONS.spawnIntervalSeconds,
    );
  });

  it('builds a match snapshot without mutating the base config', () => {
    const snapshot = createMatchConfig({
      matchDurationSeconds: 90,
      spawnIntervalSeconds: 4,
      difficulty: 'open',
    });
    expect(snapshot.matchDurationSeconds).toBe(90);
    expect(snapshot.spawn.intervalSeconds).toBe(4);
    expect(DEFAULT_GAME_CONFIG.spawn.intervalSeconds).toBe(
      DEFAULT_PLAYER_OPTIONS.spawnIntervalSeconds,
    );
  });

  it('keeps spawns outside the shooter attack range by default', () => {
    expect(DEFAULT_GAME_CONFIG.spawn.minDistanceFromPlayer).toBeGreaterThan(
      DEFAULT_GAME_CONFIG.shooter.attackRange,
    );
  });
});

describe('difficulty presets', () => {
  const at = (difficulty: (typeof DIFFICULTIES)[number]) =>
    createMatchConfig({ ...DEFAULT_PLAYER_OPTIONS, difficulty });

  it('keeps the open sea preset equal to the base balance', () => {
    const open = at('open');
    expect(open.spawn.maxAlive).toEqual(DEFAULT_GAME_CONFIG.spawn.maxAlive);
    expect(open.spawn.distribution).toEqual(DEFAULT_GAME_CONFIG.spawn.distribution);
    expect(open.shooter.cannon.damage).toBe(DEFAULT_GAME_CONFIG.shooter.cannon.damage);
    expect(open.salvage.dropChance).toBe(DEFAULT_GAME_CONFIG.salvage.dropChance);
  });

  it('orders the presets from gentle to harsh', () => {
    const [calm, open, kraken] = DIFFICULTIES.map(at);
    if (!calm || !open || !kraken) throw new Error('Missing preset');
    expect(calm.spawn.maxAlive.end).toBeLessThan(open.spawn.maxAlive.end);
    expect(kraken.spawn.maxAlive.end).toBeGreaterThan(open.spawn.maxAlive.end);
    expect(calm.shooter.cannon.damage).toBeLessThan(kraken.shooter.cannon.damage);
    expect(calm.chaser.contactDamage).toBeLessThan(kraken.chaser.contactDamage);
    expect(calm.salvage.dropChance).toBeGreaterThan(kraken.salvage.dropChance);
    expect(kraken.spawn.distribution.end.shooter).toBeGreaterThan(
      calm.spawn.distribution.end.shooter,
    );
  });

  it('never changes the options the player configured', () => {
    for (const difficulty of DIFFICULTIES) {
      const config = createMatchConfig({
        matchDurationSeconds: 90,
        spawnIntervalSeconds: 2,
        difficulty,
      });
      expect(config.matchDurationSeconds).toBe(90);
      expect(config.spawn.intervalSeconds).toBe(2);
      expect(config.salvage.lowHealthDropChance).toBeLessThanOrEqual(1);
    }
  });
});
