import type { SimulationEvent } from '../core/events';
import type { AudioManager, SoundId } from './AudioManager';

const CANNON_SHOTS: readonly SoundId[] = ['cannon_fire_1', 'cannon_fire_2', 'cannon_fire_3'];
const WATER_HITS: readonly SoundId[] = ['cannonball_water_hit_1', 'cannonball_water_hit_2'];
const WOOD_HITS: readonly SoundId[] = ['ship_wood_hit_1', 'ship_wood_hit_2'];
const EXPLOSIONS: readonly SoundId[] = ['ship_explosion_1', 'ship_explosion_2'];

export function playBattleEvents(
  audio: AudioManager,
  events: readonly SimulationEvent[],
  pick: <T>(items: readonly T[]) => T,
): void {
  for (const event of events) {
    switch (event.type) {
      case 'shot':
        if (event.slot === 'front') {
          audio.play(pick(CANNON_SHOTS), event.shooter === 'player' ? 0.7 : 0.45);
        } else {
          audio.play('cannon_broadside', 0.8);
        }
        break;
      case 'splash':
        audio.play(pick(WATER_HITS), 0.35);
        break;
      case 'hit':
        audio.play(pick(WOOD_HITS), event.target === 'player' ? 0.9 : 0.6);
        break;
      case 'destroyed':
        audio.play(pick(EXPLOSIONS), 0.8);
        audio.play('ship_sinking', 0.5);
        break;
      case 'scored':
        audio.play('score_point', 0.6);
        break;
      case 'islandBump':
        audio.play('ship_collision', 0.6);
        break;
      case 'ended':
        audio.play(event.reason === 'time' ? 'game_complete' : 'game_over', 0.9);
        break;
      case 'spawned':
      case 'playerDamaged':
        break;
    }
  }
}
