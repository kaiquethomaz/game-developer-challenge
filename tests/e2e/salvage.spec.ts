import { expect, test } from '@playwright/test';
import { advance, advanceUntil, readState, startBattle, turnTowards } from './support/game';

test.describe('repair salvage', () => {
  test('a sunk enemy can leave salvage that repairs the hull once', async ({ page }) => {
    test.slow();
    await startBattle(page, { seed: 5, spawnIntervalSeconds: 10 });
    const damaged = await advanceUntil(page, (state) => state.player.health < 100, 15);
    const target = damaged.enemies[0];
    if (!target) throw new Error('No enemy spawned');

    for (let i = 0; i < 200; i += 1) {
      const state = await readState(page);
      const enemy = state.enemies.find((ship) => ship.id === target.id);
      if (!enemy) break;
      await turnTowards(page, Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x), 0.08);
      await page.keyboard.down('Space');
      await advance(page, 0.1);
      await page.keyboard.up('Space');
    }

    const sunk = await readState(page);
    expect(sunk.score).toBe(1);
    expect(sunk.salvage).toHaveLength(1);
    const healthBefore = sunk.player.health;

    for (let i = 0; i < 40; i += 1) {
      const state = await readState(page);
      const salvage = state.salvage[0];
      if (!salvage) break;
      await turnTowards(
        page,
        Math.atan2(salvage.y - state.player.y, salvage.x - state.player.x),
        0.1,
      );
      await page.keyboard.down('KeyW');
      await advance(page, 0.3);
      await page.keyboard.up('KeyW');
    }

    const repaired = await readState(page);
    expect(repaired.salvage).toHaveLength(0);
    expect(repaired.player.health).toBeGreaterThan(healthBefore);
    expect(repaired.player.health).toBeLessThanOrEqual(100);
    await expect(page.getByTestId('battle-status')).toContainText('Hull repaired');
  });
});
