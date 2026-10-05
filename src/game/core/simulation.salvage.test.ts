import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG, type GameConfig, type SalvageConfig } from '../config';
import { createIdleIntent, type PlayerIntent } from './entities';
import type { SimulationEvent } from './events';
import { createRandom } from './random';
import { SalvageField } from './salvage';
import { Simulation } from './simulation';

const STEP = DEFAULT_GAME_CONFIG.fixedStepSeconds;

function openWater(salvage: Partial<SalvageConfig> = {}): GameConfig {
  return {
    ...DEFAULT_GAME_CONFIG,
    spawn: { ...DEFAULT_GAME_CONFIG.spawn, initialDelaySeconds: Number.POSITIVE_INFINITY },
    salvage: { ...DEFAULT_GAME_CONFIG.salvage, ...salvage },
    arena: {
      ...DEFAULT_GAME_CONFIG.arena,
      islands: [],
      playerStart: { x: 400, y: 500, heading: 0 },
    },
  };
}

function run(simulation: Simulation, seconds: number, intent: PlayerIntent = createIdleIntent()) {
  const events: SimulationEvent[] = [];
  for (let i = 0; i < Math.ceil(seconds / STEP); i += 1) {
    simulation.step(STEP, intent);
    events.push(...simulation.drainEvents());
  }
  return events;
}

function sinkShooterAhead(simulation: Simulation): SimulationEvent[] {
  const enemy = simulation.spawnEnemy('shooter', { x: 600, y: 500 }, Math.PI);
  enemy.health = 1;
  return run(simulation, 0.5, { ...createIdleIntent(), fireFront: true });
}

describe('repair salvage', () => {
  it('drops salvage where an enemy is sunk by the player', () => {
    const simulation = new Simulation(openWater({ dropChance: 1 }), 1);
    const events = sinkShooterAhead(simulation);
    const dropped = events.find((event) => event.type === 'salvageDropped');
    expect(dropped).toBeDefined();
    expect(simulation.salvage.items).toHaveLength(1);
  });

  it('never drops salvage when a chaser rams the player', () => {
    const simulation = new Simulation(openWater({ dropChance: 1, lowHealthDropChance: 1 }), 1);
    simulation.spawnEnemy('chaser', { x: 430, y: 500 }, Math.PI);
    const events = run(simulation, 0.5);
    expect(events.some((event) => event.type === 'destroyed')).toBe(true);
    expect(simulation.salvage.items).toHaveLength(0);
  });

  it('repairs the player once, up to the maximum health', () => {
    const config = openWater({ dropChance: 1 });
    const simulation = new Simulation(config, 1);
    sinkShooterAhead(simulation);
    const { player } = simulation.state;
    player.health = player.maxHealth - 5;
    const [salvage] = simulation.salvage.items;
    if (!salvage) throw new Error('No salvage dropped');
    player.position.x = salvage.position.x;
    player.position.y = salvage.position.y;

    const events = run(simulation, 0.2);
    const repairs = events.filter((event) => event.type === 'repaired');
    expect(repairs).toHaveLength(1);
    expect(repairs[0]).toMatchObject({ amount: 5, health: player.maxHealth });
    expect(player.health).toBe(player.maxHealth);
    expect(simulation.salvage.items).toHaveLength(0);
  });

  it('leaves salvage afloat while the hull is intact', () => {
    const simulation = new Simulation(openWater({ dropChance: 1 }), 1);
    sinkShooterAhead(simulation);
    const [salvage] = simulation.salvage.items;
    if (!salvage) throw new Error('No salvage dropped');
    const { player } = simulation.state;
    player.health = player.maxHealth;
    player.position.x = salvage.position.x;
    run(simulation, 0.2);
    expect(simulation.salvage.items).toHaveLength(1);
  });

  it('expires salvage after its lifetime', () => {
    const config = openWater({ dropChance: 1, lifetimeSeconds: 1 });
    const simulation = new Simulation(config, 1);
    sinkShooterAhead(simulation);
    expect(simulation.salvage.items).toHaveLength(1);
    run(simulation, 1);
    expect(simulation.salvage.items).toHaveLength(0);
  });

  it('caps active salvage and raises the drop chance on a damaged hull', () => {
    const config = { ...DEFAULT_GAME_CONFIG.salvage, dropChance: 0, lowHealthDropChance: 1 };
    const field = new SalvageField(config, createRandom(1));
    expect(field.tryDrop({ x: 0, y: 0 }, 1)).toBeNull();
    for (let i = 0; i < config.maxActive + 2; i += 1) field.tryDrop({ x: i, y: 0 }, 0.2);
    expect(field.items).toHaveLength(config.maxActive);
  });

  it('does not change the enemy spawn sequence of a seed', () => {
    const withSalvage = new Simulation(DEFAULT_GAME_CONFIG, 7);
    const without = new Simulation(
      { ...DEFAULT_GAME_CONFIG, salvage: { ...DEFAULT_GAME_CONFIG.salvage, dropChance: 0 } },
      7,
    );
    const spawns = (simulation: Simulation) =>
      run(simulation, 12).filter((event) => event.type === 'spawned');
    expect(spawns(withSalvage)).toEqual(spawns(without));
  });
});
