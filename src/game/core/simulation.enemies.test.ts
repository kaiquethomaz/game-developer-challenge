import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG, type GameConfig } from '../config';
import { createIdleIntent } from './entities';
import { distance } from './math';
import { Simulation } from './simulation';

const STEP = DEFAULT_GAME_CONFIG.fixedStepSeconds;

const openWaterConfig: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  arena: {
    ...DEFAULT_GAME_CONFIG.arena,
    islands: [],
    playerStart: { x: 300, y: 500, heading: 0 },
  },
};

function runSeconds(simulation: Simulation, seconds: number): void {
  const idle = createIdleIntent();
  for (let i = 0; i < Math.ceil(seconds / STEP); i += 1) simulation.step(STEP, idle);
}

describe('chaser', () => {
  it('pursues the player and explodes on impact without scoring', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    const chaser = simulation.spawnEnemy('chaser', { x: 900, y: 500 }, Math.PI / 2);

    runSeconds(simulation, 8);

    expect(chaser.alive).toBe(false);
    expect(simulation.state.player.health).toBe(
      openWaterConfig.player.maxHealth - openWaterConfig.chaser.contactDamage,
    );
    expect(simulation.state.score).toBe(0);
    const destroyed = simulation.drainEvents().find((event) => event.type === 'destroyed');
    expect(destroyed).toMatchObject({ cause: 'collision', kind: 'chaser' });
  });

  it('navigates around an island to reach the player', () => {
    const config: GameConfig = {
      ...openWaterConfig,
      arena: {
        ...openWaterConfig.arena,
        islands: [{ col: 8, row: 4, cols: 2, rows: 8 }],
        playerStart: { x: 200, y: 8 * 64, heading: 0 },
      },
    };
    const simulation = new Simulation(config, 1);
    const chaser = simulation.spawnEnemy('chaser', { x: 16 * 64, y: 8 * 64 }, Math.PI);

    for (let i = 0; i < Math.ceil(20 / STEP) && chaser.alive; i += 1) {
      simulation.step(STEP, createIdleIntent());
      expect(simulation.arena.hitsIsland(chaser.position, chaser.radius - 0.5)).toBe(false);
    }

    expect(chaser.alive).toBe(false);
  });
});

describe('shooter', () => {
  it('approaches to its preferred range and fires once in attack range', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    const shooter = simulation.spawnEnemy('shooter', { x: 1200, y: 500 }, Math.PI);
    const { player } = simulation.state;

    runSeconds(simulation, 10);

    const range = distance(shooter.position, player.position);
    expect(range).toBeLessThanOrEqual(openWaterConfig.shooter.attackRange);
    expect(range).toBeGreaterThan(openWaterConfig.shooter.preferredRange * 0.6);

    const events = simulation.drainEvents();
    expect(events.some((event) => event.type === 'shot' && event.shooter === 'shooter')).toBe(true);
    expect(player.health).toBeLessThan(openWaterConfig.player.maxHealth);
  });

  it('holds fire while out of range', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    simulation.spawnEnemy('shooter', { x: 1800, y: 500 }, Math.PI / 2);
    runSeconds(simulation, 0.5);
    expect(simulation.drainEvents().some((event) => event.type === 'shot')).toBe(false);
  });

  it('respects the cannon cooldown', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    simulation.spawnEnemy('shooter', { x: 600, y: 500 }, Math.PI);
    const { cooldownSeconds } = openWaterConfig.shooter.cannon;

    runSeconds(simulation, cooldownSeconds * 3 - STEP);

    const shots = simulation.drainEvents().filter((event) => event.type === 'shot');
    expect(shots.length).toBeLessThanOrEqual(3);
    expect(shots.length).toBeGreaterThanOrEqual(2);
  });
});

describe('destroyed enemies', () => {
  it('stop colliding and firing', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    const shooter = simulation.spawnEnemy('shooter', { x: 600, y: 500 }, Math.PI);
    shooter.health = 1;

    simulation.step(STEP, { ...createIdleIntent(), fireFront: true });
    runSeconds(simulation, 1);
    simulation.drainEvents();

    expect(simulation.state.enemies).not.toContain(shooter);
    runSeconds(simulation, 3);
    expect(simulation.drainEvents().some((event) => event.type === 'shot')).toBe(false);
  });
});
