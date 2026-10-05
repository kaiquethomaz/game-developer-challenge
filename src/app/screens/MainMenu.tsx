import { useWaitingMatchCount } from '../../api/queries';
import { ACTION_KEY_HINTS, ACTION_LABELS, GAME_ACTIONS } from '../../game/input/actions';
import type { MatchOutcome } from '../../game/session/GameSession';
import { Button, RoundButton } from '../../ui/Button';
import { endReasonLabel, formatClock } from '../format';

interface MainMenuProps {
  readonly lastResult: MatchOutcome | null;
  readonly onPlay: () => void;
  readonly onOptions: () => void;
  readonly onOpenLog: (tab: 'ranking' | 'history') => void;
  readonly onOpenNetworkLab: () => void;
}

export function MainMenu({
  lastResult,
  onPlay,
  onOptions,
  onOpenLog,
  onOpenNetworkLab,
}: MainMenuProps) {
  const waiting = useWaitingMatchCount();

  return (
    <section className="panel menu" aria-labelledby="menu-title">
      <h1 id="menu-title" className="menu__title">
        <img src="/assets/png/retina/ui/menu/title_pirate_battle.png" alt="Pirate Battle" />
      </h1>
      <p className="panel__subtitle">Set sail. Take command.</p>

      <div className="button-stack">
        <Button onClick={onPlay} autoFocus>
          Play
        </Button>
        <Button onClick={onOptions}>Options</Button>
      </div>

      <details className="controls-help">
        <summary>How to play</summary>
        <dl className="controls-help__list">
          {GAME_ACTIONS.map((action) => (
            <div key={action} className="controls-help__item">
              <dt>{ACTION_LABELS[action]}</dt>
              <dd>
                {ACTION_KEY_HINTS[action].map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </dd>
            </div>
          ))}
          <div className="controls-help__item">
            <dt>Pause</dt>
            <dd>
              <kbd>Esc</kbd>
              <kbd>P</kbd>
            </dd>
          </div>
        </dl>
        <p className="status-text">
          On touch screens, steer with the left buttons and fire with the right ones. Sink enemy
          ships to score; a chaser that rams you does not count. Sunk ships may leave floating
          salvage: sail over it to repair your hull.
        </p>
      </details>

      {lastResult && (
        <p className="status-text" aria-label="Last battle">
          Last battle: {lastResult.score} points · {formatClock(lastResult.durationSeconds)} ·{' '}
          {endReasonLabel(lastResult.endReason)}
        </p>
      )}
      {waiting > 0 && (
        <p className="status-text">
          {waiting === 1
            ? '1 battle is waiting to be recorded.'
            : `${waiting} battles are waiting to be recorded.`}
        </p>
      )}

      <div className="button-row">
        <Button
          variant="secondary"
          size="small"
          onClick={() => {
            onOpenLog('ranking');
          }}
        >
          Ranking
        </Button>
        <Button
          variant="secondary"
          size="small"
          onClick={() => {
            onOpenLog('history');
          }}
        >
          Match history
        </Button>
      </div>

      <div className="menu__corner">
        <RoundButton
          icon="settings"
          label="Network scenarios"
          size={44}
          onClick={onOpenNetworkLab}
        />
      </div>
    </section>
  );
}
