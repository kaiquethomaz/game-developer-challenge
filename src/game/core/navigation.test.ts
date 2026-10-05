import { describe, expect, it } from 'vitest';
import type { ArenaConfig } from '../config';
import { Arena } from './arena';
import { FlowField } from './navigation';

const config: ArenaConfig = {
  tileSize: 64,
  cols: 12,
  rows: 8,
  islands: [{ col: 5, row: 0, cols: 2, rows: 6 }],
  playerStart: { x: 0, y: 0, heading: 0 },
};

describe('FlowField', () => {
  const arena = new Arena(config);
  const field = new FlowField(arena, 24);

  it('marks island cells as blocked', () => {
    expect(field.isWalkable({ x: 6 * 64, y: 2 * 64 })).toBe(false);
    expect(field.isWalkable({ x: 2 * 64, y: 2 * 64 })).toBe(true);
  });

  it('routes around an island instead of through it', () => {
    field.build({ x: 10 * 64, y: 2 * 64 });
    const position = { x: 2 * 64, y: 2 * 64 };
    const waypoint = { x: 0, y: 0 };
    let reached = false;

    for (let i = 0; i < 200; i += 1) {
      if (!field.nextWaypoint(position, waypoint)) {
        reached = true;
        break;
      }
      expect(arena.hitsIsland(waypoint, 1)).toBe(false);
      position.x = waypoint.x;
      position.y = waypoint.y;
    }

    expect(reached).toBe(true);
    expect(position.x).toBeGreaterThan(9 * 64);
  });
});
