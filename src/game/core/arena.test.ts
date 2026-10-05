import { describe, expect, it } from 'vitest';
import type { ArenaConfig } from '../config';
import { Arena } from './arena';

const config: ArenaConfig = {
  tileSize: 64,
  cols: 10,
  rows: 6,
  islands: [{ col: 4, row: 2, cols: 2, rows: 2 }],
  playerStart: { x: 64, y: 64, heading: 0 },
};

describe('Arena', () => {
  const arena = new Arena(config);

  it('converts tile islands to world rectangles', () => {
    expect(arena.width).toBe(640);
    expect(arena.height).toBe(384);
    expect(arena.islands[0]).toEqual({ x: 256, y: 128, width: 128, height: 128 });
  });

  it('pushes a circle out of an island edge', () => {
    const position = { x: 240, y: 192 };
    expect(arena.resolveCircle(position, 20)).toBe(true);
    expect(position.x).toBeCloseTo(236);
    expect(position.y).toBe(192);
  });

  it('pushes a circle whose center entered an island out through the nearest side', () => {
    const position = { x: 262, y: 192 };
    arena.resolveCircle(position, 20);
    expect(position.x).toBe(236);
    expect(arena.hitsIsland(position, 20)).toBe(false);
  });

  it('keeps circles inside the arena bounds', () => {
    const position = { x: -50, y: 1000 };
    expect(arena.resolveCircle(position, 20)).toBe(true);
    expect(position).toEqual({ x: 20, y: 364 });
  });

  it('detects blocked and clear lines of sight', () => {
    expect(arena.hasLineOfSight({ x: 100, y: 192 }, { x: 500, y: 192 }, 4)).toBe(false);
    expect(arena.hasLineOfSight({ x: 100, y: 40 }, { x: 500, y: 40 }, 4)).toBe(true);
  });
});
