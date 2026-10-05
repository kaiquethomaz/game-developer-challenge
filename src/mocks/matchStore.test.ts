import { describe, expect, it } from 'vitest';
import type { MatchConfigSnapshot, MatchRecord, MatchSubmission } from '../api/contracts';
import { queryHistory, queryRanking, saveMatch } from './matchStore';

const config: MatchConfigSnapshot = {
  matchDurationSeconds: 120,
  spawnIntervalSeconds: 3,
  difficulty: 'open',
};

function submission(overrides: Partial<MatchSubmission>): MatchSubmission {
  return {
    matchId: 'm-1',
    playerId: 'p-1',
    captainName: 'Anne',
    playedAt: '2026-10-01T10:00:00.000Z',
    score: 10,
    durationSeconds: 120,
    endReason: 'time',
    config,
    ...overrides,
  };
}

describe('saveMatch', () => {
  it('creates a record once and returns the existing one on resubmission', () => {
    const records: MatchRecord[] = [];
    const first = saveMatch(records, submission({}), 'now');
    const second = saveMatch(records, submission({}), 'later');
    expect(first.status).toBe('created');
    expect(second).toEqual({ status: 'existing', record: first.record });
    expect(records).toHaveLength(1);
  });

  it('flags a conflicting payload for an existing match id', () => {
    const records: MatchRecord[] = [];
    saveMatch(records, submission({}), 'now');
    expect(saveMatch(records, submission({ score: 99 }), 'now').status).toBe('conflict');
    expect(records).toHaveLength(1);
  });
});

describe('queryRanking', () => {
  const records: MatchRecord[] = [];
  saveMatch(records, submission({ matchId: 'a', score: 5 }), 'now');
  saveMatch(records, submission({ matchId: 'b', score: 9, durationSeconds: 120 }), 'now');
  saveMatch(
    records,
    submission({ matchId: 'c', score: 9, durationSeconds: 80, endReason: 'death' }),
    'now',
  );
  saveMatch(
    records,
    submission({
      matchId: 'd',
      score: 50,
      config: { ...config, matchDurationSeconds: 60 },
    }),
    'now',
  );
  saveMatch(
    records,
    submission({ matchId: 'e', score: 60, config: { ...config, difficulty: 'kraken' } }),
    'now',
  );

  it('only compares matches with the same configuration', () => {
    const page = queryRanking(records, config, 1, 10);
    expect(page.items.map((entry) => entry.matchId)).not.toContain('d');
    expect(page.items.map((entry) => entry.matchId)).not.toContain('e');
    expect(page.totalItems).toBe(3);
  });

  it('orders by score and breaks ties deterministically', () => {
    const page = queryRanking(records, config, 1, 10);
    expect(page.items.map((entry) => entry.matchId)).toEqual(['c', 'b', 'a']);
    expect(page.items.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it('paginates and clamps out of range pages', () => {
    expect(queryRanking(records, config, 2, 2).items.map((entry) => entry.matchId)).toEqual(['a']);
    expect(queryRanking(records, config, 9, 2).page).toBe(2);
  });
});

describe('queryHistory', () => {
  it('returns only the player matches, newest first', () => {
    const records: MatchRecord[] = [];
    saveMatch(records, submission({ matchId: 'old', playedAt: '2026-10-01T09:00:00.000Z' }), 'n');
    saveMatch(records, submission({ matchId: 'new', playedAt: '2026-10-02T09:00:00.000Z' }), 'n');
    saveMatch(records, submission({ matchId: 'other', playerId: 'p-2' }), 'n');
    expect(queryHistory(records, 'p-1', 1, 10).items.map((record) => record.matchId)).toEqual([
      'new',
      'old',
    ]);
  });
});
