import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG, type GameConfig } from '../config';
import { createIdleIntent, type PlayerIntent, type WeaponSlot } from './entities';
import type { SimulationEvent } from './events';
import { Simulation } from './simulation';

const STEP = DEFAULT_GAME_CONFIG.fixedStepSeconds;

const openWaterConfig: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  spawn: { ...DEFAULT_GAME_CONFIG.spawn, initialDelaySeconds: Number.POSITIVE_INFINITY },
  arena: {
    ...DEFAULT_GAME_CONFIG.arena,
    islands: [],
    playerStart: { x: 400, y: 500, heading: 0 },
  },
};

function steps(simulation: Simulation, count: number, intent: PlayerIntent = createIdleIntent()) {
  for (let i = 0; i < count; i += 1) simulation.step(STEP, intent);
}

function shotSlots(events: SimulationEvent[]): WeaponSlot[] {
  return events.flatMap((event) => (event.type === 'shot' ? [event.slot] : []));
}

function secondsToSteps(seconds: number): number {
  return Math.ceil(seconds / STEP);
}

describe('player weapons', () => {
  it('fires a single front projectile along the heading', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    steps(simulation, 1, { ...createIdleIntent(), fireFront: true });
    expect(simulation.projectiles.active).toHaveLength(1);
    const [projectile] = simulation.projectiles.active;
    expect(projectile?.velocity.x).toBeCloseTo(openWaterConfig.player.frontCannon.projectileSpeed);
    expect(projectile?.velocity.y).toBeCloseTo(0);
  });

  it('fires three parallel side projectiles to each side', () => {
    const left = new Simulation(openWaterConfig, 1);
    steps(left, 1, { ...createIdleIntent(), fireLeft: true });
    const right = new Simulation(openWaterConfig, 1);
    steps(right, 1, { ...createIdleIntent(), fireRight: true });

    expect(left.projectiles.active).toHaveLength(3);
    expect(right.projectiles.active).toHaveLength(3);
    for (const projectile of left.projectiles.active) {
      expect(projectile.velocity.x).toBeCloseTo(0);
      expect(projectile.velocity.y).toBeLessThan(0);
    }
    for (const projectile of right.projectiles.active) {
      expect(projectile.velocity.y).toBeGreaterThan(0);
    }
    const xs = left.projectiles.active.map((projectile) => projectile.position.x);
    expect(new Set(xs).size).toBe(3);
  });

  it('respects the cooldown of each weapon independently', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    const holdAll: PlayerIntent = {
      ...createIdleIntent(),
      fireFront: true,
      fireLeft: true,
      fireRight: true,
    };
    steps(simulation, secondsToSteps(0.4), holdAll);
    expect(shotSlots(simulation.drainEvents()).sort()).toEqual(['front', 'left', 'right']);

    steps(simulation, secondsToSteps(0.1), holdAll);
    expect(shotSlots(simulation.drainEvents())).toEqual(['front']);
  });

  it('fires a triple volley fanned around the heading on its own cooldown', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    const volley = { ...createIdleIntent(), fireVolley: true };
    steps(simulation, 1, volley);

    const { spreadRadians, projectileCount, cooldownSeconds } = openWaterConfig.player.volley;
    const angles = simulation.projectiles.active
      .map((projectile) => Math.atan2(projectile.velocity.y, projectile.velocity.x))
      .sort((left, right) => left - right);
    expect(angles).toHaveLength(projectileCount);
    expect(angles[0]).toBeCloseTo(-spreadRadians);
    expect(angles[1]).toBeCloseTo(0);
    expect(angles[2]).toBeCloseTo(spreadRadians);
    expect(shotSlots(simulation.drainEvents())).toEqual(['volley']);

    steps(simulation, secondsToSteps(cooldownSeconds) - 2, volley);
    expect(shotSlots(simulation.drainEvents())).toEqual([]);
    steps(simulation, 3, volley);
    expect(shotSlots(simulation.drainEvents())).toEqual(['volley']);
  });

  it('keeps the front cannon to a single projectile when the volley is not used', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    steps(simulation, 1, { ...createIdleIntent(), fireFront: true });
    expect(simulation.projectiles.active).toHaveLength(1);
    expect(simulation.state.player.cooldowns.volley).toBe(0);
  });

  it('removes projectiles once they exceed their range', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    steps(simulation, 1, { ...createIdleIntent(), fireFront: true });
    const { projectileRange, projectileSpeed } = openWaterConfig.player.frontCannon;
    steps(simulation, secondsToSteps(projectileRange / projectileSpeed) + 2);
    expect(simulation.projectiles.active).toHaveLength(0);
    expect(simulation.drainEvents().some((event) => event.type === 'splash')).toBe(true);
  });

  it('stops projectiles at islands', () => {
    const config: GameConfig = {
      ...openWaterConfig,
      arena: { ...openWaterConfig.arena, islands: [{ col: 9, row: 6, cols: 2, rows: 4 }] },
    };
    const simulation = new Simulation(config, 1);
    steps(simulation, 1, { ...createIdleIntent(), fireFront: true });
    steps(simulation, secondsToSteps(0.5));
    expect(simulation.projectiles.active).toHaveLength(0);
  });
});

describe('damage and scoring', () => {
  it('damages an enemy once per projectile and scores one point on destruction', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    const enemy = simulation.spawnEnemy('chaser', { x: 600, y: 500 }, Math.PI);
    const { damage } = openWaterConfig.player.frontCannon;

    steps(simulation, 1, { ...createIdleIntent(), fireFront: true });
    steps(simulation, secondsToSteps(0.5));
    expect(enemy.health).toBe(openWaterConfig.chaser.maxHealth - damage);
    expect(simulation.state.score).toBe(0);

    steps(simulation, 1, { ...createIdleIntent(), fireFront: true });
    steps(simulation, secondsToSteps(0.5));
    expect(enemy.alive).toBe(false);
    expect(simulation.state.enemies).toHaveLength(0);
    expect(simulation.state.score).toBe(1);

    const destroyed = simulation.drainEvents().filter((event) => event.type === 'destroyed');
    expect(destroyed).toHaveLength(1);
  });

  it('awards a single point when a broadside overkills an enemy', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    simulation.spawnEnemy('chaser', { x: 400, y: 400 }, 0);
    steps(simulation, 1, { ...createIdleIntent(), fireLeft: true });
    steps(simulation, secondsToSteps(0.5));
    expect(simulation.state.score).toBe(1);
  });
});
