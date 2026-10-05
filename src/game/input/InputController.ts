import type { PlayerIntent } from '../core/entities';
import { GAME_ACTIONS, type GameAction } from './actions';

export class InputController {
  private readonly holders = new Map<GameAction, Set<string>>(
    GAME_ACTIONS.map((action) => [action, new Set<string>()]),
  );

  press(action: GameAction, source: string): void {
    this.holders.get(action)?.add(source);
  }

  release(action: GameAction, source: string): void {
    this.holders.get(action)?.delete(source);
  }

  releaseSource(source: string): void {
    for (const sources of this.holders.values()) sources.delete(source);
  }

  releaseAll(): void {
    for (const sources of this.holders.values()) sources.clear();
  }

  isHeld(action: GameAction): boolean {
    return (this.holders.get(action)?.size ?? 0) > 0;
  }

  readIntent(out: PlayerIntent): PlayerIntent {
    const left = this.isHeld('turnLeft');
    const right = this.isHeld('turnRight');
    out.thrust = this.isHeld('thrust');
    out.turn = left === right ? 0 : left ? -1 : 1;
    out.fireFront = this.isHeld('fireFront');
    out.fireLeft = this.isHeld('fireLeft');
    out.fireRight = this.isHeld('fireRight');
    return out;
  }
}
