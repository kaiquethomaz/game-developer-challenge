import { expect, test } from '@playwright/test';
import { advance, collectConsoleErrors, readState, startBattle } from './support/game';

test.describe('navigation', () => {
  test('abandoning a battle does not record it', async ({ page }) => {
    await startBattle(page, { seed: 6 });
    await advance(page, 3);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__pirateBattle)).toBeUndefined();
    await expect(page.locator('canvas')).toHaveCount(0);

    await page.getByRole('button', { name: 'Match history' }).click();
    await expect(page.getByText('You have not finished a battle yet.')).toBeVisible();
    await expect(page.getByText(/waiting to be recorded/)).toHaveCount(0);
  });

  test('reloading during combat ends the battle without recording it', async ({ page }) => {
    await startBattle(page, { seed: 6 });
    await advance(page, 2);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(page.getByLabel('Last battle')).toHaveCount(0);
    await page.getByRole('button', { name: 'Match history' }).click();
    await expect(page.getByText('You have not finished a battle yet.')).toBeVisible();
  });

  test('repeated navigation between screens keeps a single clean battle', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await startBattle(page, { seed: 6 });
    for (let round = 0; round < 3; round += 1) {
      await advance(page, 1);
      await expect(page.locator('.battle canvas')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Main menu' }).click();
      await expect(page.locator('canvas')).toHaveCount(0);
      await page.getByRole('button', { name: 'Ranking' }).click();
      await page.getByRole('button', { name: 'Main menu' }).click();
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.getByRole('button', { name: 'Set sail' }).click();
      await page.waitForFunction(() => window.__pirateBattle?.getState().elapsedSeconds === 0);
    }
    const state = await readState(page);
    expect(state.enemies).toHaveLength(0);
    expect(errors).toEqual([]);
  });
});

test.describe('touch controls', () => {
  test('move and fire at the same time with multi-touch', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch controls are shown on coarse pointers');
    await startBattle(page, { seed: 6, spawnIntervalSeconds: 10 });

    const thrust = page.getByRole('button', { name: 'Sail forward' });
    const fire = page.getByRole('button', { name: 'Fire front cannon' });
    await expect(thrust).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fire left broadside' })).toBeVisible();

    const thrustBox = await thrust.boundingBox();
    const fireBox = await fire.boundingBox();
    if (!thrustBox || !fireBox) throw new Error('Touch buttons are not laid out');
    const point = (box: { x: number; y: number; width: number; height: number }, id: number) => ({
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      id,
    });

    const cdp = await page.context().newCDPSession(page);
    const before = await readState(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point(thrustBox, 1), point(fireBox, 2)],
    });
    await expect(thrust).toHaveAttribute('data-pressed', 'true');
    await advance(page, 1);
    const during = await readState(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(thrust).toHaveAttribute('data-pressed', 'false');

    expect(during.player.x - before.player.x).toBeGreaterThan(80);
    expect(during.projectiles.some((projectile) => projectile.faction === 'player')).toBe(true);

    await advance(page, 3);
    const released = await readState(page);
    await advance(page, 1);
    expect((await readState(page)).player.x).toBeCloseTo(released.player.x, 0);
  });
});
