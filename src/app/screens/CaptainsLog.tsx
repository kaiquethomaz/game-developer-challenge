import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { toApiError } from '../../api/client';
import { DEFAULT_PAGE_SIZE, type MatchConfigSnapshot, type Page } from '../../api/contracts';
import { useHistory, usePendingMatches, useRanking, useMatchSync } from '../../api/queries';
import type { PlayerProfile } from '../../storage/settings';
import { Button, RoundButton } from '../../ui/Button';
import { endReasonLabel, formatClock, formatPlayedAt } from '../format';

export type LogTab = 'ranking' | 'history';

interface CaptainsLogProps {
  readonly tab: LogTab;
  readonly config: MatchConfigSnapshot;
  readonly profile: PlayerProfile;
  readonly highlightMatchId: string | null;
  readonly onTabChange: (tab: LogTab) => void;
  readonly onClose: () => void;
}

const TABS: readonly { id: LogTab; label: string }[] = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match history' },
];

export function CaptainsLog({
  tab,
  config,
  profile,
  highlightMatchId,
  onTabChange,
  onClose,
}: CaptainsLogProps) {
  const tabRefs = useRef<Record<LogTab, HTMLButtonElement | null>>({
    ranking: null,
    history: null,
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = TABS.findIndex((item) => item.id === tab);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? TABS.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    const next = TABS[nextIndex];
    if (!next) return;
    onTabChange(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <section className="panel panel--wide log" aria-labelledby="log-title">
      <h1 className="panel__title" id="log-title">
        Captain&apos;s log
      </h1>
      <div
        className="log__tabs"
        role="tablist"
        aria-label="Captain's log"
        onKeyDown={handleKeyDown}
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            ref={(element) => {
              tabRefs.current[item.id] = element;
            }}
            type="button"
            role="tab"
            id={`log-tab-${item.id}`}
            aria-controls={`log-panel-${item.id}`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            className={
              tab === item.id ? 'button button--small' : 'button button--small button--secondary'
            }
            onClick={() => {
              onTabChange(item.id);
            }}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`log-panel-${tab}`}
        aria-labelledby={`log-tab-${tab}`}
        className="log__panel"
        tabIndex={0}
      >
        {tab === 'ranking' ? (
          <RankingTab config={config} profile={profile} highlightMatchId={highlightMatchId} />
        ) : (
          <HistoryTab profile={profile} highlightMatchId={highlightMatchId} />
        )}
      </div>

      <Button onClick={onClose}>Main menu</Button>
    </section>
  );
}

function RankingTab({
  config,
  profile,
  highlightMatchId,
}: {
  config: MatchConfigSnapshot;
  profile: PlayerProfile;
  highlightMatchId: string | null;
}) {
  const [page, setPage] = useState(1);
  const query = useRanking({ page, pageSize: DEFAULT_PAGE_SIZE, config });

  return (
    <>
      <p className="panel__subtitle">
        {config.matchDurationSeconds} second battles · {config.spawnIntervalSeconds} second spawn
        interval
      </p>
      <QueryState
        query={query}
        label="ranking"
        emptyMessage="No battles recorded with this configuration yet. Be the first captain on the board."
      >
        {(data) => (
          <>
            <table className="log-table">
              <caption className="visually-hidden">
                Ranking, page {data.page} of {data.totalPages}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Captain</th>
                  <th scope="col">Points</th>
                  <th scope="col">Played</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => {
                  const isPlayer = entry.playerId === profile.playerId;
                  const played = formatPlayedAt(entry.playedAt);
                  return (
                    <tr
                      key={entry.matchId}
                      className={
                        isPlayer || entry.matchId === highlightMatchId
                          ? 'is-highlighted'
                          : undefined
                      }
                    >
                      <td>{String(entry.rank).padStart(2, '0')}</td>
                      <td>
                        {entry.rank === 1 && (
                          <img
                            className="log-table__star"
                            src="/assets/png/retina/ui/hud/icon_score.png"
                            alt=""
                          />
                        )}
                        {entry.captainName}
                        {isPlayer && <span className="badge">You</span>}
                      </td>
                      <td className="log-table__points">{entry.score}</td>
                      <td>
                        {played.date} · {played.time}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={data} onChange={setPage} label="Ranking pages" />
          </>
        )}
      </QueryState>
    </>
  );
}

function HistoryTab({
  profile,
  highlightMatchId,
}: {
  profile: PlayerProfile;
  highlightMatchId: string | null;
}) {
  const [page, setPage] = useState(1);
  const query = useHistory({ playerId: profile.playerId, page, pageSize: DEFAULT_PAGE_SIZE });
  const pending = usePendingMatches();
  const waiting = pending.filter((entry) => !entry.rejected).length;
  const rejected = pending.filter((entry) => entry.rejected);
  const { retryAll, discard } = useMatchSync();

  return (
    <>
      <p className="panel__subtitle">{profile.captainName} · Your recent battles</p>
      {waiting > 0 && (
        <div className="log__pending" role="status">
          <span>
            {waiting === 1
              ? '1 battle is waiting to be recorded.'
              : `${waiting} battles are waiting to be recorded.`}
          </span>
          <Button size="small" variant="secondary" onClick={retryAll}>
            Retry now
          </Button>
        </div>
      )}
      {rejected.map((entry) => (
        <div key={entry.submission.matchId} className="log__pending" role="alert">
          <span>
            A battle with {entry.submission.score} points was rejected by the server
            {entry.lastError ? `: ${entry.lastError}` : '.'}
          </span>
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              discard(entry.submission.matchId);
            }}
          >
            Discard
          </Button>
        </div>
      ))}
      <QueryState
        query={query}
        label="match history"
        emptyMessage="You have not finished a battle yet. Your completed battles will appear here."
      >
        {(data) => (
          <>
            <table className="log-table">
              <caption className="visually-hidden">
                Match history, page {data.page} of {data.totalPages}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Points</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((record) => {
                  const played = formatPlayedAt(record.playedAt);
                  return (
                    <tr
                      key={record.matchId}
                      className={record.matchId === highlightMatchId ? 'is-highlighted' : undefined}
                    >
                      <td>
                        {played.date} <span className="log-table__muted">· {played.time}</span>
                      </td>
                      <td className="log-table__points">{record.score}</td>
                      <td>{formatClock(record.durationSeconds)}</td>
                      <td className={`log-table__result log-table__result--${record.endReason}`}>
                        {endReasonLabel(record.endReason)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={data} onChange={setPage} label="Match history pages" />
          </>
        )}
      </QueryState>
    </>
  );
}

interface QueryLike<T> {
  readonly data: Page<T> | undefined;
  readonly error: unknown;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isPlaceholderData: boolean;
  readonly refetch: () => unknown;
}

function QueryState<T>({
  query,
  label,
  emptyMessage,
  children,
}: {
  query: QueryLike<T>;
  label: string;
  emptyMessage: string;
  children: (data: Page<T>) => ReactNode;
}) {
  if (query.isPending) {
    return (
      <p className="status-text log__state" role="status">
        Loading {label}…
      </p>
    );
  }

  if (query.isError && !query.data) {
    return (
      <div className="log__state">
        <p className="alert" role="alert">
          Could not load the {label}. {toApiError(query.error).message}
        </p>
        <Button size="small" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const data = query.data;
  if (!data) return null;

  return (
    <>
      <p className="status-text log__refresh" role="status">
        {query.isFetching ? `Updating ${label}…` : ''}
        {query.isError && !query.isFetching
          ? `Showing saved ${label}; the latest update failed.`
          : ''}
      </p>
      {data.totalItems === 0 ? (
        <p className="status-text log__state">{emptyMessage}</p>
      ) : (
        <div className={query.isPlaceholderData ? 'log__content is-stale' : 'log__content'}>
          {children(data)}
        </div>
      )}
    </>
  );
}

function Pagination<T>({
  page,
  onChange,
  label,
}: {
  page: Page<T>;
  onChange: (page: number) => void;
  label: string;
}) {
  return (
    <nav className="pagination" aria-label={label}>
      <RoundButton
        icon="turn_left"
        label="Previous page"
        size={44}
        disabled={page.page <= 1}
        onClick={() => {
          onChange(page.page - 1);
        }}
      />
      <span className="pagination__label" aria-live="polite">
        Page {page.page} of {page.totalPages}
      </span>
      <RoundButton
        icon="turn_right"
        label="Next page"
        size={44}
        disabled={page.page >= page.totalPages}
        onClick={() => {
          onChange(page.page + 1);
        }}
      />
    </nav>
  );
}
