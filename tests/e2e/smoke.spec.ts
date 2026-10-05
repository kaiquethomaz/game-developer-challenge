import { expect, test } from '@playwright/test';

test('app boots with the mock API worker and a clean console', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
    .toContain('mockServiceWorker.js');
  expect(consoleErrors).toEqual([]);
});
