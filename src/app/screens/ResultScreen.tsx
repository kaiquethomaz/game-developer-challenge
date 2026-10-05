import { useState } from 'react';
import { useMatchSync, useRegistrationStatus } from '../../api/queries';
import type { MatchOutcome } from '../../game/session/GameSession';
import { Button } from '../../ui/Button';
import { endReasonLabel, formatClock, formatDuration } from '../format';

interface ResultScreenProps {
  readonly outcome: MatchOutcome;
  readonly onPlayAgain: () => void;
  readonly onMainMenu: () => void;
}

export function ResultScreen({ outcome, onPlayAgain, onMainMenu }: ResultScreenProps) {
  const registration = useRegistrationStatus(outcome.matchId);
  const { retry, discard } = useMatchSync();
  const [discarded, setDiscarded] = useState(false);
  const title = outcome.endReason === 'time' ? 'Battle complete' : 'Ship sunk';

  return (
    <section className="panel result" aria-labelledby="result-title">
      <h1 className="panel__title" id="result-title">
        {title}
      </h1>
      <p className="result__score" aria-label={`${outcome.score} points`}>
        {outcome.score}
      </p>
      <p className="panel__subtitle">
        Points ·{' '}
        <span aria-label={formatDuration(outcome.durationSeconds)}>
          {formatClock(outcome.durationSeconds)}
        </span>{' '}
        · {endReasonLabel(outcome.endReason)}
      </p>

      <div
        className={`result__sync result__sync--${registration.status}`}
        role="status"
        data-testid="registration-status"
      >
        {outcome.assisted && 'Assisted test battle: it is not sent to the captain’s log.'}
        {!outcome.assisted &&
          !discarded &&
          registration.status === 'synced' &&
          'Battle recorded in the captain’s log.'}
        {discarded && 'Battle discarded.'}
        {registration.status === 'syncing' && 'Recording battle…'}
        {registration.status === 'rejected' && (
          <>
            <span role="alert">
              The server rejected this battle
              {registration.error ? `: ${registration.error}` : '.'} It cannot be recorded.
            </span>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                discard(outcome.matchId);
                setDiscarded(true);
              }}
            >
              Discard
            </Button>
          </>
        )}
        {registration.status === 'pending' && (
          <>
            <span>
              Not recorded yet{registration.error ? `: ${registration.error}` : '.'} It is saved on
              this device and will be sent again.
            </span>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                retry(outcome.matchId);
              }}
            >
              Retry now
            </Button>
          </>
        )}
      </div>

      <div className="button-stack">
        <Button onClick={onPlayAgain} autoFocus>
          Play again
        </Button>
        <Button onClick={onMainMenu}>Main menu</Button>
      </div>
    </section>
  );
}
