import type { GameConfig } from '../config';
import { Arena } from './arena';
import type { PlayerIntent, Ship } from './entities';
import type { EndReason, SimulationEvent } from './events';
import { moveShip } from './movement';

export type MatchStatus = 'running' | 'ended';

export interface SimulationState {
  elapsedSeconds: number;
  status: MatchStatus;
  endReason: EndReason | null;
  readonly player: Ship;
}

export class Simulation {
  readonly arena: Arena;
  readonly state: SimulationState;
  private events: SimulationEvent[] = [];
  private nextId = 1;
  private wasPlayerBlocked = false;

  constructor(
    readonly config: GameConfig,
    readonly seed: number,
  ) {
    this.arena = new Arena(config.arena);
    const start = config.arena.playerStart;
    this.state = {
      elapsedSeconds: 0,
      status: 'running',
      endReason: null,
      player: {
        id: this.allocateId(),
        kind: 'player',
        position: { x: start.x, y: start.y },
        heading: start.heading,
        speed: 0,
        health: config.player.maxHealth,
        maxHealth: config.player.maxHealth,
        radius: config.player.radius,
        alive: true,
        cooldowns: { front: 0, left: 0, right: 0 },
      },
    };
  }

  get remainingSeconds(): number {
    return Math.max(0, this.config.matchDurationSeconds - this.state.elapsedSeconds);
  }

  step(dt: number, intent: PlayerIntent): void {
    if (this.state.status !== 'running') return;

    this.state.elapsedSeconds += dt;
    this.updatePlayer(dt, intent);
  }

  drainEvents(): SimulationEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  private emit(event: SimulationEvent): void {
    this.events.push(event);
  }

  private allocateId(): number {
    const id = this.nextId;
    this.nextId += 1;
    return id;
  }

  private updatePlayer(dt: number, intent: PlayerIntent): void {
    const { player } = this.state;
    const blocked = moveShip(
      player,
      this.config.player,
      this.arena,
      intent.thrust ? 1 : 0,
      intent.turn,
      dt,
    );
    if (
      blocked &&
      !this.wasPlayerBlocked &&
      this.arena.hitsIsland(player.position, player.radius + 1)
    ) {
      this.emit({ type: 'islandBump', x: player.position.x, y: player.position.y });
    }
    this.wasPlayerBlocked = blocked;
  }
}
