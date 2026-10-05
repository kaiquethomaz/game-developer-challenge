import axios, { AxiosError } from 'axios';
import {
  API_ROUTES,
  type HistoryQuery,
  type MatchRecord,
  type MatchSubmission,
  type Page,
  type RankingEntry,
  type RankingQuery,
} from './contracts';

export const REQUEST_TIMEOUT_MS = 4000;

export type ApiErrorKind = 'timeout' | 'network' | 'http' | 'cancelled' | 'unknown';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isTransient(): boolean {
    if (this.kind === 'timeout' || this.kind === 'network') return true;
    return (
      this.kind === 'http' && this.status !== null && (this.status >= 500 || this.status === 429)
    );
  }
}

export const httpClient = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

httpClient.interceptors.response.use(undefined, (error: unknown) =>
  Promise.reject(toApiError(error)),
);

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isCancel(error)) return new ApiError('cancelled', 'The request was cancelled.');
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError('timeout', 'The server took too long to answer.');
    }
    if (error.response) {
      const data: unknown = error.response.data;
      const message =
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof data.message === 'string'
          ? data.message
          : `Request failed with status ${error.response.status}.`;
      return new ApiError('http', message, error.response.status);
    }
    return new ApiError('network', 'Could not reach the server.');
  }
  return new ApiError('unknown', 'Something went wrong.');
}

export async function fetchRanking(
  query: RankingQuery,
  signal: AbortSignal,
): Promise<Page<RankingEntry>> {
  const response = await httpClient.get<Page<RankingEntry>>(API_ROUTES.ranking, {
    params: {
      page: query.page,
      pageSize: query.pageSize,
      matchDurationSeconds: query.config.matchDurationSeconds,
      spawnIntervalSeconds: query.config.spawnIntervalSeconds,
      difficulty: query.config.difficulty,
    },
    signal,
  });
  return response.data;
}

export async function fetchHistory(
  query: HistoryQuery,
  signal: AbortSignal,
): Promise<Page<MatchRecord>> {
  const response = await httpClient.get<Page<MatchRecord>>(
    API_ROUTES.playerMatches(query.playerId),
    {
      params: { page: query.page, pageSize: query.pageSize },
      signal,
    },
  );
  return response.data;
}

export async function submitMatch(submission: MatchSubmission): Promise<MatchRecord> {
  const response = await httpClient.put<MatchRecord>(
    API_ROUTES.match(submission.matchId),
    submission,
  );
  return response.data;
}
