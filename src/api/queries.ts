import {
  keepPreviousData,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { fetchHistory, fetchRanking, submitMatch, toApiError, type ApiError } from './client';
import type { HistoryQuery, MatchRecord, MatchSubmission, RankingQuery } from './contracts';
import { pendingMatches } from './pendingMatches';

const MAX_RETRIES = 2;
const RECORD_MUTATION_KEY = ['recordMatch'] as const;

export const queryKeys = {
  ranking: (query: RankingQuery) => ['ranking', query.config, query.page, query.pageSize] as const,
  rankingAll: ['ranking'] as const,
  history: (query: HistoryQuery) =>
    ['history', query.playerId, query.page, query.pageSize] as const,
  historyAll: ['history'] as const,
};

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_RETRIES && toApiError(error).isTransient;
}

export function retryDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 4000);
}

export function useRanking(query: RankingQuery) {
  return useQuery({
    queryKey: queryKeys.ranking(query),
    queryFn: ({ signal }) => fetchRanking(query, signal),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    retry: shouldRetry,
    retryDelay,
  });
}

export function useHistory(query: HistoryQuery) {
  return useQuery({
    queryKey: queryKeys.history(query),
    queryFn: ({ signal }) => fetchHistory(query, signal),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    retry: shouldRetry,
    retryDelay,
  });
}

const inFlight = new Set<string>();

export function useMatchSync() {
  const queryClient = useQueryClient();
  const mutation = useMutation<MatchRecord, ApiError, MatchSubmission>({
    mutationKey: RECORD_MUTATION_KEY,
    mutationFn: async (submission) => {
      try {
        return await submitMatch(submission);
      } catch (error) {
        throw toApiError(error);
      }
    },
    retry: shouldRetry,
    retryDelay,
    onSuccess: (record) => {
      pendingMatches.remove(record.matchId);
    },
    onError: (error, submission) => {
      pendingMatches.markAttempt(submission.matchId, error.message, !error.isTransient);
    },
    onSettled: async (_record, _error, submission) => {
      inFlight.delete(submission.matchId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.rankingAll }),
        queryClient.invalidateQueries({ queryKey: queryKeys.historyAll }),
      ]);
    },
  });

  const { mutate } = mutation;

  const send = useCallback(
    (submission: MatchSubmission) => {
      if (inFlight.has(submission.matchId)) return;
      inFlight.add(submission.matchId);
      mutate(submission);
    },
    [mutate],
  );

  const submit = useCallback(
    (submission: MatchSubmission) => {
      pendingMatches.add(submission);
      send(submission);
    },
    [send],
  );

  const retry = useCallback(
    (matchId: string) => {
      const entry = pendingMatches.find(matchId);
      if (entry) send(entry.submission);
    },
    [send],
  );

  const retryAll = useCallback(() => {
    for (const entry of pendingMatches.getSnapshot()) {
      if (!entry.rejected) send(entry.submission);
    }
  }, [send]);

  const discard = useCallback((matchId: string) => {
    pendingMatches.remove(matchId);
  }, []);

  return { submit, retry, retryAll, discard };
}

export function usePendingMatches() {
  return useSyncExternalStore(pendingMatches.subscribe, pendingMatches.getSnapshot);
}

export function useWaitingMatchCount(): number {
  return usePendingMatches().filter((entry) => !entry.rejected).length;
}

export type RegistrationStatus = 'syncing' | 'pending' | 'rejected' | 'synced';

export function useRegistrationStatus(matchId: string | null): {
  status: RegistrationStatus;
  error: string | null;
} {
  const pending = usePendingMatches();
  const syncing = useMutationState({
    filters: { mutationKey: RECORD_MUTATION_KEY, status: 'pending' },
    select: (mutation) => (mutation.state.variables as MatchSubmission | undefined)?.matchId,
  });

  if (!matchId) return { status: 'synced', error: null };
  const entry = pending.find((item) => item.submission.matchId === matchId);
  if (!entry) return { status: 'synced', error: null };
  if (syncing.includes(matchId)) return { status: 'syncing', error: entry.lastError };
  if (entry.rejected) return { status: 'rejected', error: entry.lastError };
  return { status: 'pending', error: entry.lastError };
}
