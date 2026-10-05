import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG, type GameConfig } from '../config';
import { createIdleIntent, type PlayerIntent } from './entities';
import { FixedStepAccumulator } from './fixedStep';
import { Simulation } from './simulation';

function run(simulation: Simulation, seconds: number, intent: PlayerIntent, frameSeconds = 1 / 60) {
  const accumulator = new FixedStepAccumulator({
    stepSeconds: simulation.config.fixedStepSeconds,
    maxFrameSeconds: simulation.config.maxFrameSeconds,
  });
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += frameSeconds) {
    accumulator.advance(frameSeconds, (dt) => {
      simulation.step(dt, intent);
    });
  }
}

const openWaterConfig: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  spawn: { ...DEFAULT_GAME_CONFIG.spawn, initialDelaySeconds: Number.POSITIVE_INFINITY },
  arena: {
    ...DEFAULT_GAME_CONFIG.arena,
    islands: [],
    playerStart: { x: 400, y: 400, heading: 0 },
  },
};

describe('player movement', () => {
  it('moves forward along its heading', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    run(simulation, 1, { ...createIdleIntent(), thrust: true });
    const { position } = simulation.state.player;
    expect(position.x).toBeGreaterThan(450);
    expect(position.y).toBeCloseTo(400);
  });

  it('rotates both ways without moving when not thrusting', () => {
    const left = new Simulation(openWaterConfig, 1);
    const right = new Simulation(openWaterConfig, 1);
    run(left, 0.5, { ...createIdleIntent(), turn: -1 });
    run(right, 0.5, { ...createIdleIntent(), turn: 1 });
    expect(left.state.player.heading).toBeCloseTo(-openWaterConfig.player.turnSpeed * 0.5);
    expect(right.state.player.heading).toBeCloseTo(openWaterConfig.player.turnSpeed * 0.5);
    expect(left.state.player.position).toEqual({ x: 400, y: 400 });
  });

  it('reaches the same position at different frame rates', () => {
    const at30 = new Simulation(openWaterConfig, 1);
    const at144 = new Simulation(openWaterConfig, 1);
    const intent: PlayerIntent = { ...createIdleIntent(), thrust: true, turn: 1 };
    run(at30, 2, intent, 1 / 30);
    run(at144, 2, intent, 1 / 144);
    const oneStepDistance = openWaterConfig.player.maxSpeed * openWaterConfig.fixedStepSeconds;
    const drift = Math.hypot(
      at30.state.player.position.x - at144.state.player.position.x,
      at30.state.player.position.y - at144.state.player.position.y,
    );
    expect(drift).toBeLessThanOrEqual(oneStepDistance);
  });

  it('stays inside the arena bounds', () => {
    const simulation = new Simulation(openWaterConfig, 1);
    run(simulation, 15, { ...createIdleIntent(), thrust: true });
    const { player } = simulation.state;
    expect(player.position.x).toBeCloseTo(simulation.arena.width - player.radius);
  });

  it('cannot sail through an island', () => {
    const config: GameConfig = {
      ...openWaterConfig,
      arena: {
        ...openWaterConfig.arena,
        islands: [{ col: 10, row: 4, cols: 2, rows: 4 }],
        playerStart: { x: 400, y: 6 * 64, heading: 0 },
      },
    };
    const simulation = new Simulation(config, 1);
    run(simulation, 6, { ...createIdleIntent(), thrust: true });
    const { player } = simulation.state;
    expect(player.position.x).toBeCloseTo(10 * 64 - player.radius);
    expect(simulation.drainEvents().some((event) => event.type === 'islandBump')).toBe(true);
  });
});
