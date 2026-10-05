import { DEFAULT_PLAYER_OPTIONS, isDifficulty, type Difficulty } from '../game/config';
import { isRecord } from '../storage/localStore';

export type MatchEndReason = 'time' | 'death';

export interface MatchConfigSnapshot {
  readonly matchDurationSeconds: number;
  readonly spawnIntervalSeconds: number;
  readonly difficulty: Difficulty;
}

export interface MatchSubmission {
  readonly matchId: string;
  readonly playerId: string;
  readonly captainName: string;
  readonly playedAt: string;
  readonly score: number;
  readonly durationSeconds: number;
  readonly endReason: MatchEndReason;
  readonly config: MatchConfigSnapshot;
}

export interface MatchRecord extends MatchSubmission {
  readonly recordedAt: string;
}

export interface RankingEntry {
  readonly rank: number;
  readonly matchId: string;
  readonly playerId: string;
  readonly captainName: string;
  readonly score: number;
  readonly durationSeconds: number;
  readonly playedAt: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface RankingQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly config: MatchConfigSnapshot;
}

export interface HistoryQuery {
  readonly playerId: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface ApiErrorBody {
  readonly error: string;
  readonly message: string;
}

export const API_ROUTES = {
  ranking: '/api/ranking',
  playerMatches: (playerId: string) => `/api/players/${encodeURIComponent(playerId)}/matches`,
  match: (matchId: string) => `/api/matches/${encodeURIComponent(matchId)}`,
} as const;

export const DEFAULT_PAGE_SIZE = 5;
export const MAX_PAGE_SIZE = 50;

export function parseMatchSubmission(value: unknown): MatchSubmission | null {
  if (!isRecord(value) || !isRecord(value.config)) return null;
  const { matchId, playerId, captainName, playedAt, score, durationSeconds, endReason, config } =
    value;
  if (
    typeof matchId !== 'string' ||
    typeof playerId !== 'string' ||
    typeof captainName !== 'string' ||
    typeof playedAt !== 'string' ||
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < 0 ||
    typeof durationSeconds !== 'number' ||
    durationSeconds < 0 ||
    (endReason !== 'time' && endReason !== 'death') ||
    typeof config.matchDurationSeconds !== 'number' ||
    typeof config.spawnIntervalSeconds !== 'number' ||
    (config.difficulty !== undefined && !isDifficulty(config.difficulty))
  ) {
    return null;
  }
  return {
    matchId,
    playerId,
    captainName,
    playedAt,
    score,
    durationSeconds,
    endReason,
    config: {
      matchDurationSeconds: config.matchDurationSeconds,
      spawnIntervalSeconds: config.spawnIntervalSeconds,
      difficulty: parseDifficulty(config.difficulty),
    },
  };
}

export function parseDifficulty(value: unknown): Difficulty {
  return isDifficulty(value) ? value : DEFAULT_PLAYER_OPTIONS.difficulty;
}
