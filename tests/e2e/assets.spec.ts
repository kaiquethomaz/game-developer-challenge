import { expect, test } from '@playwright/test';
import { battleUrl } from './support/game';

test.describe('asset loading', () => {
  test.use({ serviceWorkers: 'block' });

  test('shows loading progress before combat starts', async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/assets/atlas/ships.json', async (route) => {
      await gate;
      await route.continue();
    });

    await page.goto(battleUrl());
    await page.getByRole('button', { name: 'Play', exact: true }).click();

    await expect(page.getByRole('progressbar', { name: 'Loading battle assets' })).toBeVisible();
    await expect(page.getByText(/Loading battle assets/)).toBeVisible();
    release();
    await page.waitForFunction(() => window.__pirateBattle !== undefined);
    await expect(page.getByRole('progressbar')).toHaveCount(0);
  });

  test('reports a failure and starts the battle after a retry', async ({ page }) => {
    let failing = true;
    await page.route('**/assets/atlas/ships.json', async (route) => {
      if (failing) await route.abort('failed');
      else await route.continue();
    });

    await page.goto(battleUrl());
    await page.getByRole('button', { name: 'Play', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText('could not be loaded');
    const retry = page.getByRole('button', { name: 'Try again' });
    await expect(retry).toBeFocused();
    expect(await page.evaluate(() => window.__pirateBattle)).toBeUndefined();

    failing = false;
    await retry.click();
    await page.waitForFunction(() => window.__pirateBattle !== undefined);
    await expect(page.locator('.battle canvas')).toHaveCount(1);
  });

  test('can return to the menu from a failed load', async ({ page }) => {
    await page.route('**/assets/atlas/**', (route) => route.abort('failed'));
    await page.goto(battleUrl());
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });
});
