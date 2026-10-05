import type { MatchConfigSnapshot, MatchRecord } from '../api/contracts';
import { createRandom } from '../game/core/random';

const CAPTAINS = [
  'Captain Flint',
  'Red Sparrow',
  'Storm Rider',
  'Sea Wolf',
  'Anne Bonny',
  'Iron Hook',
  'Mary Read',
  'Black Bart',
  'Calico Jack',
  'Grace O’Malley',
  'Salty Pete',
  'Ching Shih',
] as const;

const FIXTURE_CONFIGS: readonly MatchConfigSnapshot[] = [
  { matchDurationSeconds: 120, spawnIntervalSeconds: 3, difficulty: 'open' },
  { matchDurationSeconds: 60, spawnIntervalSeconds: 3, difficulty: 'open' },
  { matchDurationSeconds: 180, spawnIntervalSeconds: 2, difficulty: 'open' },
  { matchDurationSeconds: 120, spawnIntervalSeconds: 3, difficulty: 'calm' },
  { matchDurationSeconds: 120, spawnIntervalSeconds: 3, difficulty: 'kraken' },
];

const FIXTURE_EPOCH = Date.UTC(2026, 8, 8, 18, 0, 0);

export function createFixtureRecords(perConfig: number, seed = 2026): MatchRecord[] {
  const random = createRandom(seed);
  const records: MatchRecord[] = [];

  FIXTURE_CONFIGS.forEach((config, configIndex) => {
    for (let i = 0; i < perConfig; i += 1) {
      const captainIndex = (i + configIndex * 3) % CAPTAINS.length;
      const captainName = CAPTAINS[captainIndex] ?? 'Captain Flint';
      const died = random.next() < 0.3;
      const durationSeconds = died
        ? Math.round(random.range(config.matchDurationSeconds * 0.3, config.matchDurationSeconds))
        : config.matchDurationSeconds;
      const playedAt = new Date(FIXTURE_EPOCH - (configIndex * perConfig + i) * 23 * 60_000);

      records.push({
        matchId: `fixture-${configIndex}-${i}`,
        playerId: `fixture-player-${captainIndex}`,
        captainName,
        playedAt: playedAt.toISOString(),
        recordedAt: playedAt.toISOString(),
        score: Math.round(random.range(4, 40)),
        durationSeconds,
        endReason: died ? 'death' : 'time',
        config,
      });
    }
  });

  return records;
}
