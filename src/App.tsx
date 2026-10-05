import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { MatchSubmission } from './api/contracts';
import { useMatchSync } from './api/queries';
import type { LogTab } from './app/screens/CaptainsLog';
import { CaptainsLog } from './app/screens/CaptainsLog';
import { MainMenu } from './app/screens/MainMenu';
import { NetworkLab } from './app/screens/NetworkLab';
import { OptionsPanel } from './app/screens/OptionsPanel';
import { ResultScreen } from './app/screens/ResultScreen';
import { audio } from './game/audio/AudioManager';
import type { PlayerOptions } from './game/config';
import type { MatchOutcome } from './game/session/GameSession';
import { loadLastResult, saveLastResult } from './storage/lastResult';
import {
  loadOptions,
  loadProfile,
  saveOptions,
  saveProfile,
  loadSoundEnabled,
  saveSoundEnabled,
  type PlayerProfile,
} from './storage/settings';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './ui/components.css';
import './app/screens.css';

function lazyGameScreen() {
  return lazy(() =>
    import('./app/screens/GameScreen').then((module) => ({ default: module.GameScreen })),
  );
}

type Screen =
  | { readonly name: 'menu' }
  | { readonly name: 'log'; readonly tab: LogTab }
  | { readonly name: 'options' }
  | { readonly name: 'setup' }
  | { readonly name: 'game'; readonly run: number }
  | { readonly name: 'result' };

const SCREEN_KEY = 'pirate-battle:screen';

export function App() {
  const [options, setOptions] = useState(loadOptions);
  const [profile, setProfile] = useState<PlayerProfile>(loadProfile);
  const [lastResult, setLastResult] = useState<MatchOutcome | null>(loadLastResult);
  const [screen, setScreen] = useState<Screen>(() => initialScreen(lastResult !== null));
  const [networkLabOpen, setNetworkLabOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(loadSoundEnabled);
  const [GameScreen, setGameScreen] = useState(lazyGameScreen);
  const { submit, retryAll } = useMatchSync();

  useEffect(() => {
    retryAll();
  }, [retryAll]);

  useEffect(() => {
    audio.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const handleSoundChange = useCallback((enabled: boolean) => {
    saveSoundEnabled(enabled);
    setSoundEnabled(enabled);
  }, []);

  useEffect(() => {
    rememberScreen(screen.name === 'result' ? 'result' : null);
    document.title = screenTitle(screen);
  }, [screen]);

  const goToMenu = useCallback(() => {
    setScreen({ name: 'menu' });
  }, []);

  const startGame = useCallback(() => {
    audio.unlock();
    setScreen((current) => ({ name: 'game', run: current.name === 'game' ? current.run + 1 : 1 }));
  }, []);

  const handleSaveOptions = useCallback(
    (nextOptions: PlayerOptions, captainName: string) => {
      const nextProfile = { ...profile, captainName };
      const stored = saveOptions(nextOptions) && saveProfile(nextProfile);
      setOptions(nextOptions);
      setProfile(nextProfile);
      return stored;
    },
    [profile],
  );

  const handleMatchEnd = useCallback(
    (outcome: MatchOutcome) => {
      saveLastResult(outcome);
      setLastResult(outcome);
      if (!outcome.assisted) submit(toSubmission(outcome, profile));
    },
    [profile, submit],
  );

  const showResult = useCallback(() => {
    setScreen({ name: 'result' });
  }, []);

  return (
    <>
      {screen.name === 'game' ? (
        <ErrorBoundary
          fallback={(retry) => (
            <BattleLoadError
              onRetry={() => {
                setGameScreen(lazyGameScreen);
                retry();
              }}
              onExit={goToMenu}
            />
          )}
        >
          <Suspense fallback={<BattleFallback />}>
            <GameScreen
              key={screen.run}
              options={options}
              profile={profile}
              onSaveOptions={handleSaveOptions}
              soundEnabled={soundEnabled}
              onSoundChange={handleSoundChange}
              onMatchEnd={handleMatchEnd}
              onShowResult={showResult}
              onExit={goToMenu}
            />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <main className="screen">
          {screen.name === 'menu' && (
            <MainMenu
              lastResult={lastResult}
              onPlay={() => {
                setScreen({ name: 'setup' });
              }}
              onOptions={() => {
                setScreen({ name: 'options' });
              }}
              onOpenLog={(tab) => {
                setScreen({ name: 'log', tab });
              }}
              onOpenNetworkLab={() => {
                setNetworkLabOpen(true);
              }}
            />
          )}
          {screen.name === 'options' && (
            <OptionsPanel
              titleId="options-title"
              options={options}
              profile={profile}
              onSave={handleSaveOptions}
              soundEnabled={soundEnabled}
              onSoundChange={handleSoundChange}
              onClose={goToMenu}
              closeLabel="Main menu"
            />
          )}
          {screen.name === 'setup' && (
            <OptionsPanel
              title="Prepare for battle"
              titleId="setup-title"
              note="Check your battle settings, then set sail."
              submitLabel="Set sail"
              options={options}
              profile={profile}
              onSave={handleSaveOptions}
              onSubmitted={startGame}
              soundEnabled={soundEnabled}
              onSoundChange={handleSoundChange}
              onClose={goToMenu}
              closeLabel="Main menu"
            />
          )}
          {screen.name === 'log' && (
            <CaptainsLog
              tab={screen.tab}
              config={options}
              profile={profile}
              highlightMatchId={lastResult?.matchId ?? null}
              onTabChange={(tab) => {
                setScreen({ name: 'log', tab });
              }}
              onClose={goToMenu}
            />
          )}
          {screen.name === 'result' && lastResult && (
            <ResultScreen outcome={lastResult} onPlayAgain={startGame} onMainMenu={goToMenu} />
          )}
          <img className="brand-mark" src="/assets/logo_jungle_gaming.svg" alt="" />
        </main>
      )}

      <Dialog
        open={networkLabOpen}
        labelledBy="network-lab-title"
        onCancel={() => {
          setNetworkLabOpen(false);
        }}
      >
        <NetworkLab
          onClose={() => {
            setNetworkLabOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}

function BattleFallback() {
  return (
    <div className="screen">
      <p className="status-text" role="status">
        Preparing the battle…
      </p>
    </div>
  );
}

function BattleLoadError({ onRetry, onExit }: { onRetry: () => void; onExit: () => void }) {
  return (
    <div className="screen">
      <section className="panel" aria-labelledby="battle-error-title">
        <h1 className="panel__title" id="battle-error-title">
          Stuck in port
        </h1>
        <p className="alert" role="alert">
          The battle could not start. Check your connection and try again.
        </p>
        <div className="button-stack">
          <Button onClick={onRetry} autoFocus>
            Try again
          </Button>
          <Button variant="secondary" onClick={onExit}>
            Main menu
          </Button>
        </div>
      </section>
    </div>
  );
}

function toSubmission(outcome: MatchOutcome, profile: PlayerProfile): MatchSubmission {
  return {
    matchId: outcome.matchId,
    playerId: profile.playerId,
    captainName: profile.captainName,
    playedAt: outcome.endedAt,
    score: outcome.score,
    durationSeconds: outcome.durationSeconds,
    endReason: outcome.endReason,
    config: outcome.options,
  };
}

function initialScreen(hasResult: boolean): Screen {
  try {
    if (hasResult && window.sessionStorage.getItem(SCREEN_KEY) === 'result') {
      return { name: 'result' };
    }
  } catch {
    return { name: 'menu' };
  }
  return { name: 'menu' };
}

function rememberScreen(value: 'result' | null): void {
  try {
    if (value) window.sessionStorage.setItem(SCREEN_KEY, value);
    else window.sessionStorage.removeItem(SCREEN_KEY);
  } catch {
    return;
  }
}

function screenTitle(screen: Screen): string {
  switch (screen.name) {
    case 'game':
      return 'Battle · Pirate Battle';
    case 'options':
      return 'Options · Pirate Battle';
    case 'setup':
      return 'Prepare for battle · Pirate Battle';
    case 'log':
      return `${screen.tab === 'ranking' ? 'Ranking' : 'Match history'} · Pirate Battle`;
    case 'result':
      return 'Battle result · Pirate Battle';
    case 'menu':
      return 'Pirate Battle';
  }
}
