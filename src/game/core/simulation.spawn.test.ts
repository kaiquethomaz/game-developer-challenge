import { describe, expect, it } from 'vitest';
import { createMatchConfig, DEFAULT_GAME_CONFIG, DEFAULT_PLAYER_OPTIONS } from '../config';
import { createIdleIntent } from './entities';
import type { SimulationEvent } from './events';
import { distance } from './math';
import { Simulation } from './simulation';

const STEP = DEFAULT_GAME_CONFIG.fixedStepSeconds;

function collect(simulation: Simulation, seconds: number): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  const idle = createIdleIntent();
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
    simulation.step(STEP, idle);
    events.push(...simulation.drainEvents());
  }
  return events;
}

describe('enemy spawning', () => {
  it('spawns on the configured interval after the initial delay', () => {
    const config = createMatchConfig({ ...DEFAULT_PLAYER_OPTIONS, spawnIntervalSeconds: 2 });
    const simulation = new Simulation(config, 3);
    const spawnTimes: number[] = [];
    const idle = createIdleIntent();

    for (let i = 0; i < Math.round(8 / STEP); i += 1) {
      simulation.step(STEP, idle);
      if (simulation.drainEvents().some((event) => event.type === 'spawned')) {
        spawnTimes.push(simulation.state.elapsedSeconds);
      }
    }

    expect(spawnTimes[0]).toBeCloseTo(config.spawn.initialDelaySeconds, 1);
    for (let i = 1; i < spawnTimes.length; i += 1) {
      expect((spawnTimes[i] ?? 0) - (spawnTimes[i - 1] ?? 0)).toBeCloseTo(2, 1);
    }
    expect(spawnTimes.length).toBeGreaterThanOrEqual(3);
  });

  it('spawns both enemy types within the first two spawns', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const simulation = new Simulation(DEFAULT_GAME_CONFIG, seed);
      const spawned = collect(simulation, DEFAULT_GAME_CONFIG.spawn.initialDelaySeconds + 3.1)
        .flatMap((event) => (event.type === 'spawned' ? [event.kind] : []))
        .slice(0, 2);
      expect(spawned.sort()).toEqual(['chaser', 'shooter']);
    }
  });

  it('places enemies away from the player and off islands', () => {
    const simulation = new Simulation(DEFAULT_GAME_CONFIG, 11);
    const { player } = simulation.state;
    const idle = createIdleIntent();

    for (let i = 0; i < Math.round(20 / STEP); i += 1) {
      simulation.step(STEP, idle);
      for (const event of simulation.drainEvents()) {
        if (event.type !== 'spawned') continue;
        const enemy = simulation.state.enemies.find((ship) => ship.id === event.id);
        expect(enemy).toBeDefined();
        if (!enemy) continue;
        expect(distance(enemy.position, player.position)).toBeGreaterThanOrEqual(
          DEFAULT_GAME_CONFIG.spawn.minDistanceFromPlayer,
        );
        expect(simulation.arena.isCircleBlocked(enemy.position, enemy.radius)).toBe(false);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = collect(new Simulation(DEFAULT_GAME_CONFIG, 99), 15);
    const b = collect(new Simulation(DEFAULT_GAME_CONFIG, 99), 15);
    expect(a).toEqual(b);
  });
});
