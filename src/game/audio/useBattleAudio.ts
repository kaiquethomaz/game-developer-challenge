import { useEffect, useRef } from 'react';
import { LOW_HEALTH_RATIO, TIME_WARNING_SECONDS } from '../session/alerts';
import type { GameSession } from '../session/GameSession';
import type { HudSnapshot } from '../session/HudStore';
import { audio } from './AudioManager';
import { playBattleEvents } from './battleSounds';

function pickRandom<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)] ?? items[0];
  if (item === undefined) throw new Error('Cannot pick from an empty list');
  return item;
}

export function useBattleAudio(session: GameSession, hud: HudSnapshot): void {
  const previous = useRef(hud);

  useEffect(() => {
    audio.play('game_start', 0.8);
    void audio.startAmbience();
    const unsubscribe = session.onEvents((events) => {
      playBattleEvents(audio, events, pickRandom);
    });
    return () => {
      unsubscribe();
      audio.stopAmbience();
    };
  }, [session]);

  useEffect(() => {
    const before = previous.current;
    previous.current = hud;

    if (hud.status !== before.status) {
      if (hud.status === 'paused') {
        audio.play('game_pause', 0.7);
        audio.stopAmbience();
      } else if (hud.status === 'running' && before.status === 'paused') {
        audio.play('game_resume', 0.7);
        void audio.startAmbience();
      } else if (hud.status === 'ended') {
        audio.stopAmbience();
      }
      return;
    }

    if (
      hud.remainingSeconds === TIME_WARNING_SECONDS &&
      before.remainingSeconds > TIME_WARNING_SECONDS
    ) {
      audio.play('time_warning', 0.8);
    }
    const threshold = hud.maxHealth * LOW_HEALTH_RATIO;
    if (hud.health <= threshold && before.health > threshold && hud.health > 0) {
      audio.play('health_low', 0.8);
    }
  }, [hud]);
}
