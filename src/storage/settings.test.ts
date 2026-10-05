import { describe, expect, it } from 'vitest';
import { validateOptions } from './settings';

const valid = {
  matchDurationSeconds: '120',
  spawnIntervalSeconds: '3',
  difficulty: 'open',
  captainName: 'Anne',
} as const;

describe('validateOptions', () => {
  it('accepts values within the documented limits', () => {
    expect(validateOptions(valid)).toEqual({
      options: { matchDurationSeconds: 120, spawnIntervalSeconds: 3, difficulty: 'open' },
      captainName: 'Anne',
    });
  });

  it('rejects durations outside 60 to 180 seconds and non integers', () => {
    expect(validateOptions({ ...valid, matchDurationSeconds: '59' })).toHaveProperty(
      'errors.matchDurationSeconds',
    );
    expect(validateOptions({ ...valid, matchDurationSeconds: '181' })).toHaveProperty(
      'errors.matchDurationSeconds',
    );
    expect(validateOptions({ ...valid, matchDurationSeconds: '90.5' })).toHaveProperty(
      'errors.matchDurationSeconds',
    );
  });

  it('requires a positive spawn interval on the half-second step', () => {
    expect(validateOptions({ ...valid, spawnIntervalSeconds: '0' })).toHaveProperty(
      'errors.spawnIntervalSeconds',
    );
    expect(validateOptions({ ...valid, spawnIntervalSeconds: '2.3' })).toHaveProperty(
      'errors.spawnIntervalSeconds',
    );
    expect(validateOptions({ ...valid, spawnIntervalSeconds: '2.5' })).toHaveProperty(
      'options.spawnIntervalSeconds',
      2.5,
    );
  });

  it('validates the captain name length', () => {
    expect(validateOptions({ ...valid, captainName: ' A ' })).toHaveProperty('errors.captainName');
  });
});
