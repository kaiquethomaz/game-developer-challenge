import { expect, test, type Page } from '@playwright/test';
import { readState, startBattle } from './support/game';

async function realtimeBattle(page: Page): Promise<void> {
  await startBattle(page, { seed: 6, spawnIntervalSeconds: 10, manualClock: false });
  await page.waitForFunction(() => (window.__pirateBattle?.getState().elapsedSeconds ?? 0) > 0.3);
}

test.describe('pause', () => {
  test('manual pause suspends the timer and cooldowns until resumed', async ({ page }) => {
    await realtimeBattle(page);
    await page.keyboard.down('Space');
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    await page.keyboard.up('Space');

    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Resume' })).toBeFocused();
    const paused = await readState(page);
    expect(paused.status).toBe('paused');

    await page.waitForTimeout(1500);
    const stillPaused = await readState(page);
    expect(stillPaused.elapsedSeconds).toBe(paused.elapsedSeconds);
    expect(stillPaused.player.cooldowns).toEqual(paused.player.cooldowns);
    expect(stillPaused.projectiles).toEqual(paused.projectiles);

    await dialog.getByRole('button', { name: 'Resume' }).click();
    await expect(dialog).toBeHidden();
    await page.waitForTimeout(400);
    const resumed = await readState(page);
    expect(resumed.status).toBe('running');
    expect(resumed.elapsedSeconds - paused.elapsedSeconds).toBeLessThan(1);
    expect(resumed.elapsedSeconds).toBeGreaterThan(paused.elapsedSeconds);
  });

  test('held input is not carried over the pause', async ({ page }) => {
    await realtimeBattle(page);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.keyboard.up('KeyW');
    const paused = await readState(page);

    await page.getByRole('button', { name: 'Resume' }).click();
    await page.waitForTimeout(800);
    const resumed = await readState(page);
    const travelled = Math.hypot(
      resumed.player.x - paused.player.x,
      resumed.player.y - paused.player.y,
    );
    expect(travelled).toBeLessThan(120);
    expect(
      resumed.projectiles.filter((projectile) => projectile.faction === 'player'),
    ).toHaveLength(0);
  });

  test('pauses automatically when the window loses focus or the tab is hidden', async ({
    page,
  }) => {
    await realtimeBattle(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByRole('dialog', { name: 'Paused' })).toContainText('lost focus');
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByRole('dialog', { name: 'Paused' })).toContainText('tab was hidden');
    const hidden = await readState(page);
    await page.waitForTimeout(1000);
    expect((await readState(page)).elapsedSeconds).toBe(hidden.elapsedSeconds);
  });

  test('game keys are only captured during gameplay', async ({ page }) => {
    await realtimeBattle(page);
    await page.keyboard.press('Escape');
    const before = await readState(page);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');
    expect((await readState(page)).player).toEqual(before.player);
  });
});
