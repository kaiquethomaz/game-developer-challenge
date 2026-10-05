import { describe, expect, it } from 'vitest';
import {
  clampOption,
  createMatchConfig,
  DEFAULT_GAME_CONFIG,
  DEFAULT_PLAYER_OPTIONS,
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
    const snapshot = createMatchConfig({ matchDurationSeconds: 90, spawnIntervalSeconds: 4 });
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
