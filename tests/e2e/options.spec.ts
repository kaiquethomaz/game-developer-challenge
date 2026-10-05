import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from './support/game';

test.describe('options', () => {
  test('navigates from the menu, validates and persists options after refresh', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/?latency=0');
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();

    const duration = page.getByLabel('Game session time', { exact: true });
    const spawn = page.getByLabel('Enemy spawn time', { exact: true });

    await duration.fill('30');
    await spawn.fill('0');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Choose between 60 and 180 seconds.')).toBeVisible();
    await expect(page.getByText('Choose between 1 and 10 seconds.')).toBeVisible();
    await expect(duration).toHaveAttribute('aria-invalid', 'true');

    await spawn.fill('2.3');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Use steps of 0.5 seconds.')).toBeVisible();

    await duration.fill('90');
    await spawn.fill('2.5');
    await page.getByRole('radio', { name: /Kraken's Wrath/ }).check();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Options saved' })).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await expect(page.getByLabel('Game session time', { exact: true })).toHaveValue('90');
    await expect(page.getByLabel('Enemy spawn time', { exact: true })).toHaveValue('2.5');
    await expect(page.getByRole('radio', { name: /Kraken's Wrath/ })).toBeChecked();

    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('steppers respect the limits', async ({ page }) => {
    await page.goto('/?latency=0');
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    const increase = page.getByRole('button', { name: 'Increase game session time' });
    for (let i = 0; i < 10; i += 1) {
      if (await increase.isDisabled()) break;
      await increase.click();
    }
    await expect(page.getByLabel('Game session time', { exact: true })).toHaveValue('180');
    await expect(increase).toBeDisabled();
  });

  test('menus are keyboard navigable with visible focus', async ({ page }) => {
    await page.goto('/?latency=0');
    const play = page.getByRole('button', { name: 'Play', exact: true });
    await expect(play).toBeFocused();
    await page.keyboard.press('Tab');
    const options = page.getByRole('button', { name: 'Options', exact: true });
    await expect(options).toBeFocused();
    const shadow = await options.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(shadow).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();
  });

  test('corrupted stored options fall back to defaults', async ({ page }) => {
    await page.goto('/?latency=0');
    await page.evaluate(() => {
      localStorage.setItem('pirate-battle:options', '{"matchDurationSeconds":"NaN"}');
    });
    await page.reload();
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await expect(page.getByLabel('Game session time', { exact: true })).toHaveValue('120');
  });
});
