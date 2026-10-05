import { expect, test } from '@playwright/test';
import { advance, advanceUntil, readState, startBattle } from './support/game';

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test.describe('enemies', () => {
  test('spawn on the configured interval, far from the player and off islands', async ({
    page,
  }) => {
    await startBattle(page, { seed: 9, spawnIntervalSeconds: 2 });
    const spawnTimes = new Map<number, number>();

    for (let i = 0; i < 40; i += 1) {
      await advance(page, 0.2);
      const state = await readState(page);
      for (const enemy of state.enemies) {
        if (spawnTimes.has(enemy.id)) continue;
        spawnTimes.set(enemy.id, state.elapsedSeconds);
        expect(distance(enemy, state.player)).toBeGreaterThan(500);
        for (const island of state.arena.islands) {
          const inside =
            enemy.x > island.x - 20 &&
            enemy.x < island.x + island.width + 20 &&
            enemy.y > island.y - 20 &&
            enemy.y < island.y + island.height + 20;
          expect(inside).toBe(false);
        }
      }
    }

    const times = [...spawnTimes.values()].sort((a, b) => a - b);
    expect(times.length).toBeGreaterThanOrEqual(4);
    expect(times[0]).toBeCloseTo(1.5, 0);
    for (let i = 1; i < times.length; i += 1) {
      expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeCloseTo(2, 0);
    }
  });

  test('both chasers and shooters appear in a standard match', async ({ page }) => {
    await startBattle(page, { seed: 4 });
    const kinds = new Set<string>();
    await advanceUntil(
      page,
      (state) => {
        for (const enemy of state.enemies) kinds.add(enemy.kind);
        return kinds.size === 2;
      },
      10,
    );
    expect([...kinds].sort()).toEqual(['chaser', 'shooter']);
  });

  test('a chaser pursues the player and explodes on impact without scoring', async ({ page }) => {
    await startBattle(page, { seed: 6, spawnIntervalSeconds: 10 });
    const spawned = await advanceUntil(page, (state) => state.enemies.length > 0, 3);
    const chaserState = await advanceUntil(
      page,
      (state) => state.enemies.some((enemy) => enemy.kind === 'chaser'),
      12,
    );
    const chaser = chaserState.enemies.find((enemy) => enemy.kind === 'chaser');
    if (!chaser) throw new Error('No chaser spawned');
    const startDistance = distance(chaser, chaserState.player);
    expect(spawned.enemies.length).toBeGreaterThan(0);

    await advance(page, 1);
    const closer = await readState(page);
    const moved = closer.enemies.find((enemy) => enemy.id === chaser.id);
    expect(moved).toBeDefined();
    if (moved) expect(distance(moved, closer.player)).toBeLessThan(startDistance);

    const healthBefore = closer.player.health;
    const impact = await advanceUntil(
      page,
      (state) => !state.enemies.some((enemy) => enemy.id === chaser.id),
      12,
    );
    expect(impact.player.health).toBeLessThanOrEqual(healthBefore - 20);
    expect(impact.score).toBe(0);
  });

  test('a shooter closes in and fires once in range', async ({ page }) => {
    await startBattle(page, { seed: 4, spawnIntervalSeconds: 10 });
    const withShooter = await advanceUntil(
      page,
      (state) => state.enemies.some((enemy) => enemy.kind === 'shooter'),
      14,
    );
    const shooter = withShooter.enemies.find((enemy) => enemy.kind === 'shooter');
    if (!shooter) throw new Error('No shooter spawned');

    const firing = await advanceUntil(
      page,
      (state) => state.projectiles.some((projectile) => projectile.faction === 'enemy'),
      12,
    );
    const current = firing.enemies.find((enemy) => enemy.id === shooter.id);
    expect(current).toBeDefined();
    if (current) {
      expect(distance(current, firing.player)).toBeLessThanOrEqual(430);
      expect(distance(current, firing.player)).toBeGreaterThan(120);
    }
  });
});
