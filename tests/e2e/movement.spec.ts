import { expect, test } from '@playwright/test';
import { advance, holdKeys, readState, startBattle, turnTowards } from './support/game';

test.describe('movement', () => {
  test.beforeEach(async ({ page }) => {
    await startBattle(page, { seed: 21, spawnIntervalSeconds: 10 });
  });

  test('starts a battle with full health, zero score and the configured time', async ({ page }) => {
    const state = await readState(page);
    expect(state.status).toBe('running');
    expect(state.player.health).toBe(100);
    expect(state.score).toBe(0);
    expect(state.remainingSeconds).toBe(120);
    await expect(page.getByTestId('hud-time')).toHaveText('02:00');
    await expect(page.getByRole('meter', { name: 'Ship health' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });

  test('sails forward along the heading only while thrusting', async ({ page }) => {
    const before = await readState(page);
    await holdKeys(page, ['KeyW'], 1);
    const after = await readState(page);
    expect(after.player.x - before.player.x).toBeGreaterThan(80);
    expect(Math.abs(after.player.y - before.player.y)).toBeLessThan(1);

    await advance(page, 2);
    const coasted = await readState(page);
    expect(coasted.player.x - after.player.x).toBeLessThan(200);
    await advance(page, 1);
    const stopped = await readState(page);
    expect(stopped.player.x).toBeCloseTo(coasted.player.x, 0);
  });

  test('rotates both ways without moving', async ({ page }) => {
    await holdKeys(page, ['KeyA'], 0.5);
    const left = await readState(page);
    expect(left.player.heading).toBeLessThan(-1);

    await holdKeys(page, ['ArrowRight'], 1);
    const right = await readState(page);
    expect(right.player.heading).toBeGreaterThan(left.player.heading + 2);
    expect(right.player.x).toBeCloseTo(left.player.x, 3);
  });

  test('moves and turns at the same time', async ({ page }) => {
    const before = await readState(page);
    await holdKeys(page, ['KeyW', 'KeyD', 'Space'], 1);
    const after = await readState(page);
    expect(after.player.heading).toBeGreaterThan(before.player.heading + 1);
    expect(
      Math.hypot(after.player.x - before.player.x, after.player.y - before.player.y),
    ).toBeGreaterThan(50);
    expect(after.projectiles.some((projectile) => projectile.faction === 'player')).toBe(true);
  });

  test('stays inside the visible arena', async ({ page }) => {
    await holdKeys(page, ['KeyW'], 12);
    const state = await readState(page);
    expect(state.player.x).toBeLessThanOrEqual(state.arena.width - 25);
    expect(state.player.x).toBeGreaterThan(state.arena.width - 40);
  });

  test('cannot sail through an island', async ({ page }) => {
    await turnTowards(page, 0.6);
    await page.keyboard.down('KeyW');
    let touched = false;
    for (let i = 0; i < 40; i += 1) {
      await advance(page, 0.1);
      const { player, arena } = await readState(page);
      for (const island of arena.islands) {
        const nearestX = Math.max(island.x, Math.min(player.x, island.x + island.width));
        const nearestY = Math.max(island.y, Math.min(player.y, island.y + island.height));
        const gap = Math.hypot(player.x - nearestX, player.y - nearestY);
        expect(gap).toBeGreaterThanOrEqual(25.5);
        if (gap < 28) touched = true;
      }
    }
    await page.keyboard.up('KeyW');
    expect(touched).toBe(true);
  });
});
