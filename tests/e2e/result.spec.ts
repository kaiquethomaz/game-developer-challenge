import { expect, test } from '@playwright/test';
import { advanceUntil, startBattle } from './support/game';

test.describe('result', () => {
  test('shows the outcome and keeps it after a refresh', async ({ page }) => {
    await startBattle(page, { seed: 4, spawnIntervalSeconds: 10 });
    const ended = await advanceUntil(page, (state) => state.status === 'ended', 40, 1);
    const result = page.getByRole('region', { name: 'Ship sunk' });
    await expect(result).toBeVisible();
    await expect(result.getByLabel(`${ended.score} points`)).toBeVisible();
    await expect(page.getByTestId('registration-status')).toContainText('recorded');

    await page.reload();
    await expect(page.getByRole('region', { name: 'Ship sunk' })).toBeVisible();
    await expect(page.getByLabel(`${ended.score} points`)).toBeVisible();

    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByLabel('Last battle')).toContainText('Defeated');
    await page.reload();
    await expect(page.getByLabel('Last battle')).toContainText('Defeated');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });
});
