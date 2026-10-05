import type {
  MatchConfigSnapshot,
  MatchRecord,
  MatchSubmission,
  Page,
  RankingEntry,
} from '../api/contracts';

export type SaveResult =
  | { readonly status: 'created'; readonly record: MatchRecord }
  | { readonly status: 'existing'; readonly record: MatchRecord }
  | { readonly status: 'conflict'; readonly record: MatchRecord };

export function sameConfig(a: MatchConfigSnapshot, b: MatchConfigSnapshot): boolean {
  return (
    a.matchDurationSeconds === b.matchDurationSeconds &&
    a.spawnIntervalSeconds === b.spawnIntervalSeconds
  );
}

export function compareRanking(a: MatchRecord, b: MatchRecord): number {
  return (
    b.score - a.score ||
    a.durationSeconds - b.durationSeconds ||
    a.playedAt.localeCompare(b.playedAt) ||
    a.matchId.localeCompare(b.matchId)
  );
}

export function saveMatch(
  records: MatchRecord[],
  submission: MatchSubmission,
  now: string,
): SaveResult {
  const existing = records.find((record) => record.matchId === submission.matchId);
  if (existing) {
    return isSameSubmission(existing, submission)
      ? { status: 'existing', record: existing }
      : { status: 'conflict', record: existing };
  }
  const record: MatchRecord = { ...submission, recordedAt: now };
  records.push(record);
  return { status: 'created', record };
}

export function queryRanking(
  records: readonly MatchRecord[],
  config: MatchConfigSnapshot,
  page: number,
  pageSize: number,
): Page<RankingEntry> {
  const ranked = records
    .filter((record) => sameConfig(record.config, config))
    .sort(compareRanking)
    .map((record, index): RankingEntry => ({
      rank: index + 1,
      matchId: record.matchId,
      playerId: record.playerId,
      captainName: record.captainName,
      score: record.score,
      durationSeconds: record.durationSeconds,
      playedAt: record.playedAt,
    }));
  return paginate(ranked, page, pageSize);
}

export function queryHistory(
  records: readonly MatchRecord[],
  playerId: string,
  page: number,
  pageSize: number,
): Page<MatchRecord> {
  const history = records
    .filter((record) => record.playerId === playerId)
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt) || a.matchId.localeCompare(b.matchId));
  return paginate(history, page, pageSize);
}

function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    pageSize,
    totalItems: items.length,
    totalPages,
  };
}

function isSameSubmission(record: MatchRecord, submission: MatchSubmission): boolean {
  return (
    record.playerId === submission.playerId &&
    record.score === submission.score &&
    record.durationSeconds === submission.durationSeconds &&
    record.endReason === submission.endReason &&
    sameConfig(record.config, submission.config)
  );
}
