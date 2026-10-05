import { describe, expect, it } from 'vitest';
import { createMatchConfig, DEFAULT_GAME_CONFIG, DEFAULT_PLAYER_OPTIONS } from '../config';
import { createIdleIntent } from './entities';
import type { SimulationEvent } from './events';
import { distance } from './math';
import { createRandom } from './random';
import { Simulation } from './simulation';
import { EnemySpawner } from './spawner';

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

describe('spawn pressure over the match', () => {
  const { spawn } = DEFAULT_GAME_CONFIG;

  it('raises the alive cap from the start to the end of the match', () => {
    const spawner = new EnemySpawner(spawn, createRandom(1));
    expect(spawner.maxAliveAt(0)).toBe(spawn.maxAlive.start);
    expect(spawner.maxAliveAt(1)).toBe(spawn.maxAlive.end);
    expect(spawner.maxAliveAt(0.5)).toBeGreaterThan(spawn.maxAlive.start);
    expect(spawner.maxAliveAt(0.5)).toBeLessThan(spawn.maxAlive.end);
    expect(spawner.maxAliveAt(2)).toBe(spawn.maxAlive.end);
  });

  it('never keeps more enemies alive than the current cap', () => {
    const simulation = new Simulation(
      createMatchConfig({ matchDurationSeconds: 60, spawnIntervalSeconds: 1 }),
      5,
    );
    const idle = createIdleIntent();
    for (let i = 0; i < Math.round(20 / STEP); i += 1) {
      simulation.step(STEP, idle);
      const progress = simulation.state.elapsedSeconds / 60;
      const cap = Math.round(
        spawn.maxAlive.start + (spawn.maxAlive.end - spawn.maxAlive.start) * progress,
      );
      expect(simulation.state.enemies.length).toBeLessThanOrEqual(cap);
    }
  });

  it('shifts the enemy mix towards shooters late in the match', () => {
    const count = (progress: number) => {
      const spawner = new EnemySpawner(
        { ...spawn, initialDelaySeconds: 0, intervalSeconds: 0 },
        createRandom(3),
      );
      let shooters = 0;
      for (let i = 0; i < 400; i += 1) {
        const kind = spawner.update(0, 0, progress);
        if (!kind) continue;
        spawner.confirm(kind);
        if (kind === 'shooter') shooters += 1;
      }
      return shooters;
    };
    expect(count(1)).toBeGreaterThan(count(0));
  });
});
