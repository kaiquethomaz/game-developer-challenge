import { describe, expect, it } from 'vitest';
import { createMatchConfig, DEFAULT_GAME_CONFIG, DEFAULT_PLAYER_OPTIONS } from '../config';
import { createIdleIntent, type PlayerIntent } from './entities';
import { Simulation } from './simulation';

const STEP = DEFAULT_GAME_CONFIG.fixedStepSeconds;

function runSeconds(
  simulation: Simulation,
  seconds: number,
  intent: PlayerIntent = createIdleIntent(),
) {
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) simulation.step(STEP, intent);
}

describe('match rules', () => {
  it('ends by time exactly at the configured duration', () => {
    const config = createMatchConfig({ ...DEFAULT_PLAYER_OPTIONS, matchDurationSeconds: 60 });
    const simulation = new Simulation(
      { ...config, spawn: { ...config.spawn, initialDelaySeconds: Number.POSITIVE_INFINITY } },
      1,
    );

    runSeconds(simulation, 59.9);
    expect(simulation.state.status).toBe('running');

    runSeconds(simulation, 0.2);
    expect(simulation.state.status).toBe('ended');
    expect(simulation.state.endReason).toBe('time');
    expect(simulation.state.elapsedSeconds).toBe(60);
    expect(simulation.remainingSeconds).toBe(0);
  });

  it('ends by death when health reaches zero', () => {
    const simulation = new Simulation(DEFAULT_GAME_CONFIG, 1);
    simulation.state.player.health = 1;
    const shooter = simulation.spawnEnemy(
      'shooter',
      { x: simulation.state.player.position.x + 200, y: simulation.state.player.position.y },
      Math.PI,
    );
    shooter.cooldowns.front = 0;

    runSeconds(simulation, 3);

    expect(simulation.state.status).toBe('ended');
    expect(simulation.state.endReason).toBe('death');
    expect(simulation.state.player.alive).toBe(false);
    expect(simulation.state.player.health).toBe(0);
  });

  it('freezes movement, attacks, spawns and scoring after the end', () => {
    const config = createMatchConfig({
      matchDurationSeconds: 60,
      spawnIntervalSeconds: 1,
    });
    const simulation = new Simulation(config, 5);
    const holdAll: PlayerIntent = {
      thrust: true,
      turn: 1,
      fireFront: true,
      fireLeft: true,
      fireRight: true,
      fireVolley: true,
    };
    runSeconds(simulation, 61, holdAll);
    expect(simulation.state.status).toBe('ended');
    simulation.drainEvents();

    const { player, enemies } = simulation.state;
    const before = {
      player: { ...player.position, heading: player.heading },
      enemies: enemies.map((enemy) => ({ ...enemy.position })),
      enemyCount: enemies.length,
      score: simulation.state.score,
      projectiles: simulation.projectiles.active.map((projectile) => ({ ...projectile.position })),
    };

    runSeconds(simulation, 5, holdAll);

    expect({
      player: { ...player.position, heading: player.heading },
      enemies: enemies.map((enemy) => ({ ...enemy.position })),
      enemyCount: enemies.length,
      score: simulation.state.score,
      projectiles: simulation.projectiles.active.map((projectile) => ({ ...projectile.position })),
    }).toEqual(before);
    expect(simulation.drainEvents()).toEqual([]);
  });

  it('emits nothing after the ended event within the final step', () => {
    const simulation = new Simulation(
      { ...DEFAULT_GAME_CONFIG, spawn: { ...DEFAULT_GAME_CONFIG.spawn, initialDelaySeconds: 1e9 } },
      1,
    );
    const { player } = simulation.state;
    player.health = 1;
    simulation.step(STEP, { ...createIdleIntent(), fireFront: true });
    simulation.spawnEnemy('chaser', { x: player.position.x - 40, y: player.position.y }, 0);
    simulation.drainEvents();

    simulation.step(STEP, createIdleIntent());
    const events = simulation.drainEvents();
    expect(events.at(-1)).toEqual({ type: 'ended', reason: 'death' });
    expect(simulation.state.score).toBe(0);
  });

  it('emits a single ended event', () => {
    const simulation = new Simulation(
      createMatchConfig({ ...DEFAULT_PLAYER_OPTIONS, matchDurationSeconds: 60 }),
      1,
    );
    const ended: unknown[] = [];
    for (let i = 0; i < Math.round(62 / STEP); i += 1) {
      simulation.step(STEP, createIdleIntent());
      ended.push(...simulation.drainEvents().filter((event) => event.type === 'ended'));
    }
    expect(ended).toHaveLength(1);
  });

  it('starts every new match from a clean state', () => {
    const first = new Simulation(DEFAULT_GAME_CONFIG, 8);
    runSeconds(first, 10, { ...createIdleIntent(), thrust: true, fireFront: true });

    const second = new Simulation(DEFAULT_GAME_CONFIG, 8);
    expect(second.state.score).toBe(0);
    expect(second.state.elapsedSeconds).toBe(0);
    expect(second.state.enemies).toHaveLength(0);
    expect(second.state.player.health).toBe(DEFAULT_GAME_CONFIG.player.maxHealth);
    expect(second.projectiles.active).toHaveLength(0);
  });
});

describe('profiling instrumentation', () => {
  it('keeps an invulnerable player alive while every other rule still applies', () => {
    const simulation = new Simulation(DEFAULT_GAME_CONFIG, 4, { invulnerablePlayer: true });
    runSeconds(simulation, 40);
    expect(simulation.state.status).toBe('running');
    expect(simulation.state.player.health).toBe(DEFAULT_GAME_CONFIG.player.maxHealth);
    expect(simulation.state.enemies.length).toBeGreaterThan(0);
  });
});
