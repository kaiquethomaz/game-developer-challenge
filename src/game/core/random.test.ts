import { describe, expect, it } from 'vitest';
import { createRandom } from './random';

describe('createRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const sequenceA = Array.from({ length: 5 }, () => a.next());
    const sequenceB = Array.from({ length: 5 }, () => b.next());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('produces different sequences for different seeds', () => {
    expect(createRandom(1).next()).not.toEqual(createRandom(2).next());
  });

  it('stays within the requested range', () => {
    const random = createRandom(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = random.range(-3, 5);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThan(5);
    }
  });
});
