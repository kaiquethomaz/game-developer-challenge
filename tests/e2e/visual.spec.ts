import { expect, test } from '@playwright/test';
import { startBattle } from './support/game';

const RESULT = {
  matchId: 'visual-baseline-match',
  seed: 1,
  score: 24,
  durationSeconds: 120,
  endReason: 'time',
  options: { matchDurationSeconds: 120, spawnIntervalSeconds: 3 },
  endedAt: '2026-09-08T19:36:00.000Z',
};

test.describe('visual regression', () => {
  test('main menu', async ({ page }) => {
    await page.goto('/?latency=0');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeFocused();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await expect(page).toHaveScreenshot('menu.png');
  });

  test('arena in a stable state', async ({ page }) => {
    await startBattle(page, { seed: 1 });
    await expect(page.getByTestId('hud-time')).toHaveText('02:00');
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('arena.png');
  });

  test('result screen', async ({ page }) => {
    await page.goto('/?latency=0');
    await page.evaluate((result) => {
      localStorage.setItem('pirate-battle:last-result', JSON.stringify(result));
      sessionStorage.setItem('pirate-battle:screen', 'result');
    }, RESULT);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Battle complete' })).toBeVisible();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await expect(page).toHaveScreenshot('result.png');
  });
});
