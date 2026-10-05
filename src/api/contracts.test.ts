import { describe, expect, it } from 'vitest';
import { parseMatchSubmission } from './contracts';

const submission = {
  matchId: 'm-1',
  playerId: 'p-1',
  captainName: 'Anne',
  playedAt: '2026-10-01T10:00:00.000Z',
  score: 12,
  durationSeconds: 120,
  endReason: 'time',
  config: { matchDurationSeconds: 120, spawnIntervalSeconds: 3, difficulty: 'kraken' },
};

describe('parseMatchSubmission', () => {
  it('keeps the difficulty the battle was played on', () => {
    expect(parseMatchSubmission(submission)?.config.difficulty).toBe('kraken');
  });

  it('reads records saved before difficulties existed as open sea battles', () => {
    const legacy = {
      ...submission,
      config: { matchDurationSeconds: 120, spawnIntervalSeconds: 3 },
    };
    expect(parseMatchSubmission(legacy)?.config.difficulty).toBe('open');
  });

  it('rejects an unknown difficulty', () => {
    const invalid = { ...submission, config: { ...submission.config, difficulty: 'tsunami' } };
    expect(parseMatchSubmission(invalid)).toBeNull();
  });
});
