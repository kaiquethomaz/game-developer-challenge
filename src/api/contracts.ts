export type MatchEndReason = 'time' | 'death';

export interface MatchConfigSnapshot {
  readonly matchDurationSeconds: number;
  readonly spawnIntervalSeconds: number;
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
