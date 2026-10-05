import { describe, expect, it } from 'vitest';
import { FixedStepAccumulator } from './fixedStep';

const STEP = 1 / 60;

function simulate(frameSeconds: number, totalSeconds: number): number {
  const accumulator = new FixedStepAccumulator({ stepSeconds: STEP, maxFrameSeconds: 0.25 });
  let simulated = 0;
  for (let elapsed = 0; elapsed < totalSeconds - 1e-9; elapsed += frameSeconds) {
    accumulator.advance(frameSeconds, (dt) => {
      simulated += dt;
    });
  }
  return simulated;
}

describe('FixedStepAccumulator', () => {
  it('simulates the same time regardless of frame rate', () => {
    const at30 = simulate(1 / 30, 2);
    const at144 = simulate(1 / 144, 2);
    expect(at30).toBeCloseTo(2, 1);
    expect(at144).toBeCloseTo(2, 1);
    expect(Math.abs(at30 - at144)).toBeLessThanOrEqual(STEP);
  });

  it('clamps long frames to avoid a spiral of death', () => {
    const accumulator = new FixedStepAccumulator({ stepSeconds: STEP, maxFrameSeconds: 0.25 });
    const steps = accumulator.advance(5, () => undefined);
    expect(steps).toBe(15);
  });

  it('drops leftover time on reset', () => {
    const accumulator = new FixedStepAccumulator({ stepSeconds: STEP, maxFrameSeconds: 0.25 });
    accumulator.advance(STEP * 0.9, () => undefined);
    accumulator.reset();
    expect(accumulator.advance(STEP * 0.5, () => undefined)).toBe(0);
  });
});
