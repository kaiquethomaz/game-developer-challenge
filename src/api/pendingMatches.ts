import { isRecord, readJson, writeJson } from '../storage/localStore';
import { parseMatchSubmission, type MatchSubmission } from './contracts';

const PENDING_KEY = 'pirate-battle:pending-matches';

export interface PendingMatch {
  readonly submission: MatchSubmission;
  readonly attempts: number;
  readonly lastError: string | null;
}

type Listener = () => void;

class PendingMatchStore {
  private entries: readonly PendingMatch[] = readJson(PENDING_KEY, parseEntries) ?? [];
  private readonly listeners = new Set<Listener>();

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): readonly PendingMatch[] => this.entries;

  find(matchId: string): PendingMatch | undefined {
    return this.entries.find((entry) => entry.submission.matchId === matchId);
  }

  add(submission: MatchSubmission): void {
    if (this.find(submission.matchId)) return;
    this.update([...this.entries, { submission, attempts: 0, lastError: null }]);
  }

  markAttempt(matchId: string, error: string | null): void {
    this.update(
      this.entries.map((entry) =>
        entry.submission.matchId === matchId
          ? { ...entry, attempts: entry.attempts + 1, lastError: error }
          : entry,
      ),
    );
  }

  remove(matchId: string): void {
    this.update(this.entries.filter((entry) => entry.submission.matchId !== matchId));
  }

  reload(): void {
    this.entries = readJson(PENDING_KEY, parseEntries) ?? [];
    this.emit();
  }

  private update(entries: readonly PendingMatch[]): void {
    this.entries = entries;
    writeJson(PENDING_KEY, entries);
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const pendingMatches = new PendingMatchStore();

function parseEntries(value: unknown): PendingMatch[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((item): PendingMatch[] => {
    if (!isRecord(item)) return [];
    const submission = parseMatchSubmission(item.submission);
    if (!submission) return [];
    return [
      {
        submission,
        attempts: typeof item.attempts === 'number' ? item.attempts : 0,
        lastError: typeof item.lastError === 'string' ? item.lastError : null,
      },
    ];
  });
}
