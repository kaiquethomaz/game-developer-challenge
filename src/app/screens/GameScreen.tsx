import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { createMatchConfig, type PlayerOptions } from '../../game/config';
import { createSeed } from '../../game/core/random';
import type { GameAction } from '../../game/input/actions';
import type { InputController } from '../../game/input/InputController';
import type { GameTextures } from '../../game/render/textures';
import type { HudSnapshot } from '../../game/session/HudStore';
import { GameSession, type MatchOutcome } from '../../game/session/GameSession';
import { useGameTextures } from '../../game/useGameTextures';
import type { PlayerProfile } from '../../storage/settings';
import { exposeSession, readE2EOptions } from '../../testing/e2eHooks';
import { Button, RoundButton } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useMediaQuery } from '../../ui/useMediaQuery';
import { useBattleAudio } from '../../game/audio/useBattleAudio';
import { ANNOUNCED_SECONDS_LEFT, LOW_HEALTH_RATIO } from '../../game/session/alerts';
import { endReasonLabel, formatClock } from '../format';
import { OptionsPanel } from './OptionsPanel';

const RESULT_DELAY_MS = 1200;

interface GameScreenProps {
  readonly options: PlayerOptions;
  readonly profile: PlayerProfile;
  readonly onSaveOptions: (options: PlayerOptions, captainName: string) => boolean;
  readonly soundEnabled: boolean;
  readonly onSoundChange: (enabled: boolean) => void;
  readonly onMatchEnd: (outcome: MatchOutcome) => void;
  readonly onShowResult: () => void;
  readonly onExit: () => void;
}

export function GameScreen(props: GameScreenProps) {
  const textures = useGameTextures();

  if (textures.status === 'loading') {
    const percent = Math.round(textures.progress * 100);
    return (
      <div className="screen">
        <section className="panel" aria-labelledby="loading-title">
          <h1 className="panel__title" id="loading-title">
            Raising the sails
          </h1>
          <div
            className="progress"
            role="progressbar"
            aria-label="Loading battle assets"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="progress__fill" style={{ width: `${percent}%` }} />
          </div>
          <p className="status-text">Loading battle assets… {percent}%</p>
          <Button variant="secondary" onClick={props.onExit}>
            Main menu
          </Button>
        </section>
      </div>
    );
  }

  if (textures.status === 'error') {
    return (
      <div className="screen">
        <section className="panel" aria-labelledby="load-error-title">
          <h1 className="panel__title" id="load-error-title">
            Stuck in port
          </h1>
          <p className="alert" role="alert">
            The battle assets could not be loaded. Check your connection and try again.
          </p>
          <p className="status-text">{textures.message}</p>
          <div className="button-stack">
            <Button onClick={textures.retry} autoFocus>
              Try again
            </Button>
            <Button variant="secondary" onClick={props.onExit}>
              Main menu
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return <Battle {...props} textures={textures.textures} />;
}

type OverlayProps = Omit<GameScreenProps, 'onMatchEnd'>;

function Battle({
  textures,
  onMatchEnd,
  ...overlayProps
}: GameScreenProps & { textures: GameTextures }) {
  const { options } = overlayProps;
  const hostRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [mountFailed, setMountFailed] = useState(false);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const notifyMatchEnd = useEffectEvent((outcome: MatchOutcome) => {
    onMatchEnd(outcome);
  });
  const readStartSettings = useEffectEvent(() => ({ options, reducedMotion }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const e2e = readE2EOptions();
    const { options: matchOptions, reducedMotion: startReducedMotion } = readStartSettings();
    const next = new GameSession({
      config: createMatchConfig(matchOptions),
      options: matchOptions,
      seed: e2e.seed ?? createSeed(),
      textures,
      clock: e2e.manualClock ? 'manual' : 'realtime',
      reducedMotion: startReducedMotion,
      invulnerablePlayer: e2e.invulnerablePlayer,
      onEnd: (outcome) => {
        notifyMatchEnd(outcome);
      },
    });
    let removeProbe: (() => void) | null = null;

    next
      .mount(host)
      .then(() => {
        if (next.isDisposed) return;
        if (e2e.enabled) removeProbe = exposeSession(next);
        setSession(next);
      })
      .catch((error: unknown) => {
        console.warn('Failed to start the battle renderer', error);
        if (!next.isDisposed) setMountFailed(true);
      });

    return () => {
      removeProbe?.();
      next.destroy();
      setSession(null);
    };
  }, [textures]);

  if (mountFailed) {
    return (
      <div className="screen">
        <section className="panel" aria-labelledby="renderer-error-title">
          <h1 className="panel__title" id="renderer-error-title">
            Stuck in port
          </h1>
          <p className="alert" role="alert">
            Your browser could not start the battle graphics. Make sure WebGL is enabled.
          </p>
          <Button onClick={overlayProps.onExit} autoFocus>
            Main menu
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="battle">
      <div ref={hostRef} className="battle__canvas" />
      <div className="rotate-hint" role="note">
        <img src="/assets/png/retina/ui/controls/icon_restart.png" alt="" width={48} height={48} />
        <p>Rotate your device to landscape to play.</p>
      </div>
      {session && <BattleOverlay session={session} {...overlayProps} />}
    </div>
  );
}

function BattleOverlay({
  session,
  profile,
  options,
  onSaveOptions,
  soundEnabled,
  onSoundChange,
  onShowResult,
  onExit,
}: OverlayProps & { session: GameSession }) {
  const hud = useSyncExternalStore(session.hud.subscribe, session.hud.getSnapshot);
  useBattleAudio(session, hud);
  const [showOptions, setShowOptions] = useState(false);
  const isCoarsePointer = useMediaQuery('(pointer: coarse)');
  const showTouch = isCoarsePointer || new URLSearchParams(window.location.search).has('touch');

  useEffect(() => {
    if (hud.status !== 'ended') return;
    const timer = window.setTimeout(onShowResult, RESULT_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [hud.status, onShowResult]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (hud.status !== 'running') return;
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        session.pause('manual');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [hud.status, session]);

  return (
    <>
      <Hud
        hud={hud}
        onPause={() => {
          session.pause('manual');
        }}
      />
      <BattleAnnouncer hud={hud} />
      {showTouch && hud.status === 'running' && <TouchControls input={session.input} />}

      <Dialog
        open={hud.status === 'paused'}
        labelledBy={showOptions ? 'pause-options-title' : 'pause-title'}
        onCancel={() => {
          if (showOptions) setShowOptions(false);
        }}
      >
        {showOptions ? (
          <OptionsPanel
            titleId="pause-options-title"
            options={options}
            profile={profile}
            note="Changes apply to your next battle."
            onSave={onSaveOptions}
            soundEnabled={soundEnabled}
            onSoundChange={onSoundChange}
            onClose={() => {
              setShowOptions(false);
            }}
            closeLabel="Back"
          />
        ) : (
          <section className="panel" aria-labelledby="pause-title">
            <h1 className="panel__title" id="pause-title">
              Paused
            </h1>
            <p className="status-text">{pauseMessage(hud.pauseReason)}</p>
            <div className="button-stack">
              <Button
                data-autofocus
                onClick={() => {
                  session.resume();
                }}
              >
                Resume
              </Button>
              <Button
                onClick={() => {
                  setShowOptions(true);
                }}
              >
                Options
              </Button>
              <Button onClick={onExit}>Main menu</Button>
            </div>
            <p className="status-text">
              Leaving now abandons this battle; it will not be recorded.
            </p>
          </section>
        )}
      </Dialog>
    </>
  );
}

function pauseMessage(reason: HudSnapshot['pauseReason']): string {
  switch (reason) {
    case 'focus':
      return 'The game paused because the window lost focus.';
    case 'hidden':
      return 'The game paused while the tab was hidden.';
    default:
      return 'Ready when you are.';
  }
}

function Hud({ hud, onPause }: { hud: HudSnapshot; onPause: () => void }) {
  const ratio = hud.maxHealth > 0 ? hud.health / hud.maxHealth : 0;
  const fill = ratio > 0.5 ? 'green' : ratio > 0.25 ? 'amber' : 'red';
  return (
    <header className="hud">
      <div className="hud__health">
        <img className="hud__heart" src="/assets/png/retina/ui/hud/icon_heart.png" alt="" />
        <div
          className="hud__health-bar"
          role="meter"
          aria-label="Ship health"
          aria-valuemin={0}
          aria-valuemax={hud.maxHealth}
          aria-valuenow={hud.health}
          aria-valuetext={`${hud.health} of ${hud.maxHealth}`}
        >
          <div
            className={`hud__health-fill hud__health-fill--${fill}`}
            style={{ clipPath: `inset(0 ${100 - ratio * 100}% 0 0)` }}
          />
          <span className="hud__health-text" aria-hidden="true">
            {hud.health} / {hud.maxHealth}
          </span>
        </div>
      </div>
      <div className="hud__counters">
        <div className="hud__counter" aria-label={`Score ${hud.score}`}>
          <img src="/assets/png/retina/ui/hud/icon_score.png" alt="" />
          <span aria-hidden="true" data-testid="hud-score">
            {hud.score}
          </span>
        </div>
        <div className="hud__counter" aria-label={`Time left ${formatClock(hud.remainingSeconds)}`}>
          <img src="/assets/png/retina/ui/hud/icon_time.png" alt="" />
          <span aria-hidden="true" data-testid="hud-time">
            {formatClock(hud.remainingSeconds)}
          </span>
        </div>
        <RoundButton
          icon="pause"
          label="Pause"
          size={52}
          onClick={onPause}
          disabled={hud.status !== 'running'}
        />
      </div>
    </header>
  );
}

function BattleAnnouncer({ hud }: { hud: HudSnapshot }) {
  const [previous, setPrevious] = useState(hud);
  const [message, setMessage] = useState('Battle started.');

  if (hud !== previous) {
    setPrevious(hud);
    const next = describeHudChange(previous, hud);
    if (next) setMessage(next);
  }

  return (
    <div className="visually-hidden" role="status" aria-live="polite" data-testid="battle-status">
      {message}
    </div>
  );
}

function describeHudChange(before: HudSnapshot, hud: HudSnapshot): string | null {
  if (hud.status !== before.status) {
    if (hud.status === 'paused') return 'Game paused.';
    if (hud.status === 'running' && before.status === 'paused') return 'Game resumed.';
    if (hud.status === 'ended' && hud.endReason) {
      return `Battle over: ${endReasonLabel(hud.endReason)}. Final score ${hud.score}.`;
    }
    return null;
  }
  if (hud.score !== before.score) return `Enemy sunk. Score ${hud.score}.`;
  if (
    hud.remainingSeconds !== before.remainingSeconds &&
    ANNOUNCED_SECONDS_LEFT.has(hud.remainingSeconds)
  ) {
    return `${hud.remainingSeconds} seconds left.`;
  }
  if (hud.health > before.health) return `Hull repaired: ${hud.health} health.`;
  if (hud.health < before.health && hud.health <= hud.maxHealth * LOW_HEALTH_RATIO) {
    return `Hull critical: ${hud.health} health left.`;
  }
  return null;
}

const TOUCH_LEFT: readonly {
  action: GameAction;
  icon: 'turn_left' | 'forward' | 'turn_right';
  label: string;
}[] = [
  { action: 'turnLeft', icon: 'turn_left', label: 'Turn left' },
  { action: 'thrust', icon: 'forward', label: 'Sail forward' },
  { action: 'turnRight', icon: 'turn_right', label: 'Turn right' },
];

const TOUCH_RIGHT: readonly {
  action: GameAction;
  icon: 'fire_left' | 'fire_front' | 'fire_right';
  label: string;
}[] = [
  { action: 'fireLeft', icon: 'fire_left', label: 'Fire left broadside' },
  { action: 'fireFront', icon: 'fire_front', label: 'Fire front cannon' },
  { action: 'fireRight', icon: 'fire_right', label: 'Fire right broadside' },
];

function TouchControls({ input }: { input: InputController }) {
  return (
    <div className="touch-controls" aria-label="Touch controls">
      <div className="touch-controls__cluster touch-controls__cluster--move">
        {TOUCH_LEFT.map((item) => (
          <TouchButton key={item.action} input={input} {...item} />
        ))}
      </div>
      <div className="touch-controls__cluster touch-controls__cluster--fire">
        {TOUCH_RIGHT.map((item) => (
          <TouchButton key={item.action} input={input} {...item} />
        ))}
      </div>
    </div>
  );
}

function TouchButton({
  input,
  action,
  icon,
  label,
}: {
  input: InputController;
  action: GameAction;
  icon: 'turn_left' | 'forward' | 'turn_right' | 'fire_left' | 'fire_front' | 'fire_right';
  label: string;
}) {
  const [pressed, setPressed] = useState(false);
  const pointers = useRef(new Set<number>());

  useEffect(() => {
    const active = pointers.current;
    return () => {
      for (const pointerId of active) input.release(action, `pointer:${pointerId}`);
      active.clear();
    };
  }, [action, input]);

  const release = (pointerId: number) => {
    if (!pointers.current.delete(pointerId)) return;
    input.release(action, `pointer:${pointerId}`);
    setPressed(pointers.current.size > 0);
  };

  return (
    <RoundButton
      icon={icon}
      label={label}
      size={72}
      data-pressed={pressed}
      data-action={action}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.add(event.pointerId);
        input.press(action, `pointer:${event.pointerId}`);
        setPressed(true);
      }}
      onPointerUp={(event) => {
        release(event.pointerId);
      }}
      onPointerCancel={(event) => {
        release(event.pointerId);
      }}
      onLostPointerCapture={(event) => {
        release(event.pointerId);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    />
  );
}
