import { useCallback, useEffect, useState } from 'react';
import type { MatchSubmission } from './api/contracts';
import { useMatchSync } from './api/queries';
import type { LogTab } from './app/screens/CaptainsLog';
import { CaptainsLog } from './app/screens/CaptainsLog';
import { GameScreen } from './app/screens/GameScreen';
import { MainMenu } from './app/screens/MainMenu';
import { NetworkLab } from './app/screens/NetworkLab';
import { OptionsPanel } from './app/screens/OptionsPanel';
import { ResultScreen } from './app/screens/ResultScreen';
import type { PlayerOptions } from './game/config';
import type { MatchOutcome } from './game/session/GameSession';
import { loadLastResult, saveLastResult } from './storage/lastResult';
import {
  loadOptions,
  loadProfile,
  saveOptions,
  saveProfile,
  type PlayerProfile,
} from './storage/settings';
import { Dialog } from './ui/Dialog';
import './ui/components.css';
import './app/screens.css';

type Screen =
  | { readonly name: 'menu' }
  | { readonly name: 'log'; readonly tab: LogTab }
  | { readonly name: 'options' }
  | { readonly name: 'game'; readonly run: number }
  | { readonly name: 'result' };

const SCREEN_KEY = 'pirate-battle:screen';

export function App() {
  const [options, setOptions] = useState(loadOptions);
  const [profile, setProfile] = useState<PlayerProfile>(loadProfile);
  const [lastResult, setLastResult] = useState<MatchOutcome | null>(loadLastResult);
  const [screen, setScreen] = useState<Screen>(() => initialScreen(lastResult !== null));
  const [networkLabOpen, setNetworkLabOpen] = useState(false);
  const { submit, retryAll } = useMatchSync();

  useEffect(() => {
    retryAll();
  }, [retryAll]);

  useEffect(() => {
    rememberScreen(screen.name === 'result' ? 'result' : null);
    document.title = screenTitle(screen);
  }, [screen]);

  const goToMenu = useCallback(() => {
    setScreen({ name: 'menu' });
  }, []);

  const startGame = useCallback(() => {
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
      submit(toSubmission(outcome, profile));
    },
    [profile, submit],
  );

  const showResult = useCallback(() => {
    setScreen({ name: 'result' });
  }, []);

  return (
    <>
      {screen.name === 'game' ? (
        <GameScreen
          key={screen.run}
          options={options}
          profile={profile}
          onSaveOptions={handleSaveOptions}
          onMatchEnd={handleMatchEnd}
          onShowResult={showResult}
          onExit={goToMenu}
        />
      ) : (
        <main className="screen">
          {screen.name === 'menu' && (
            <MainMenu
              lastResult={lastResult}
              onPlay={startGame}
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
    case 'log':
      return `${screen.tab === 'ranking' ? 'Ranking' : 'Match history'} · Pirate Battle`;
    case 'result':
      return 'Battle result · Pirate Battle';
    case 'menu':
      return 'Pirate Battle';
  }
}
