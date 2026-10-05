import { expect, test, type Page } from '@playwright/test';
import { advanceUntil, startBattle } from './support/game';

async function finishBattle(page: Page, scenario: string): Promise<number> {
  await startBattle(page, { seed: 4, spawnIntervalSeconds: 10, scenario });
  const ended = await advanceUntil(page, (state) => state.status === 'ended', 40, 1);
  await expect(page.getByRole('region', { name: 'Ship sunk' })).toBeVisible();
  return ended.score;
}

async function historyRows(page: Page) {
  await page.getByRole('button', { name: 'Main menu' }).click();
  await page.getByRole('button', { name: 'Match history' }).click();
  return page
    .getByRole('tabpanel')
    .getByRole('row')
    .filter({ has: page.getByRole('cell') });
}

async function chooseScenario(page: Page, scenario: string): Promise<void> {
  await page.getByRole('button', { name: 'Network scenarios' }).click();
  const dialog = page.getByRole('dialog', { name: 'Network scenarios' });
  await dialog.getByRole('radio', { name: new RegExp(`^${scenario}`) }).check();
  await dialog.getByRole('button', { name: 'Close' }).click();
}

test.describe('match registration', () => {
  test('records a finished battle once and refreshes both tabs', async ({ page }) => {
    const score = await finishBattle(page, 'success');
    await expect(page.getByTestId('registration-status')).toContainText('Battle recorded');

    const rows = await historyRows(page);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Defeated');
    await expect(rows.first()).toContainText(String(score));

    await page.getByRole('tab', { name: 'Ranking' }).click();
    await expect(page.getByText('120 second battles · 10 second spawn interval')).toBeVisible();
    const you = page.getByRole('row').filter({ hasText: 'You' });
    await expect(you).toHaveCount(1);
  });

  test('keeps a pending battle across a refresh and records it after recovery', async ({
    page,
  }) => {
    await finishBattle(page, 'record-unavailable');
    const status = page.getByTestId('registration-status');
    await expect(status).toContainText('Not recorded yet', { timeout: 15_000 });

    await page.reload();
    await expect(page.getByTestId('registration-status')).toContainText('Not recorded yet', {
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByText('1 battle is waiting to be recorded.')).toBeVisible();

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForFunction(() => window.__pirateBattle !== undefined);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main menu' }).click();

    await chooseScenario(page, 'success');
    await page.getByRole('button', { name: 'Match history' }).click();
    await page.getByRole('button', { name: 'Retry now' }).click();
    const rows = page
      .getByRole('tabpanel')
      .getByRole('row')
      .filter({ has: page.getByRole('cell') });
    await expect(rows).toHaveCount(1);
    await expect(page.getByText(/waiting to be recorded/)).toHaveCount(0);
  });

  test('resending after a timeout does not duplicate the battle', async ({ page }) => {
    await finishBattle(page, 'record-timeout');
    const status = page.getByTestId('registration-status');
    await expect(status).toContainText('Recording battle');
    await expect(status).toContainText('Battle recorded', { timeout: 20_000 });

    const rows = await historyRows(page);
    await expect(rows).toHaveCount(1);
  });

  test('a battle rejected by the server can be discarded and is not retried', async ({ page }) => {
    await finishBattle(page, 'client-error');
    const status = page.getByTestId('registration-status');
    await expect(status).toContainText('The server rejected this battle');
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(status).toContainText('Battle discarded.');

    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByText(/waiting to be recorded/)).toHaveCount(0);
    const pending = await page.evaluate(() =>
      localStorage.getItem('pirate-battle:pending-matches'),
    );
    expect(JSON.parse(pending ?? '[]')).toEqual([]);
  });

  test('assisted test battles are never sent to the captain’s log', async ({ page }) => {
    await page.goto('/?e2e=1&clock=manual&seed=4&latency=0&invulnerable=1');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForFunction(() => window.__pirateBattle !== undefined);
    await page.evaluate(() => {
      for (let i = 0; i < 121 * 60; i += 1) window.__pirateBattle?.advance(1 / 60);
    });
    await expect(page.getByTestId('registration-status')).toContainText('Assisted test battle');
    const rows = await historyRows(page);
    await expect(page.getByText('You have not finished a battle yet.')).toBeVisible();
    await expect(rows).toHaveCount(0);
  });

  test('repeated retry clicks do not duplicate the battle', async ({ page }) => {
    test.slow();
    await finishBattle(page, 'record-unavailable');
    await expect(page.getByTestId('registration-status')).toContainText('Not recorded yet', {
      timeout: 15_000,
    });
    await page.goto('/?scenario=success&latency=400');
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Match history' }).click();
    const retry = page.getByRole('button', { name: 'Retry now' });
    if (await retry.isVisible()) {
      await retry.click();
      await retry.click({ force: true }).catch(() => undefined);
    }
    const rows = page
      .getByRole('tabpanel')
      .getByRole('row')
      .filter({ has: page.getByRole('cell') });
    await expect(rows).toHaveCount(1, { timeout: 10_000 });
    await page.reload();
    await page.getByRole('button', { name: 'Match history' }).click();
    await expect(
      page
        .getByRole('tabpanel')
        .getByRole('row')
        .filter({ has: page.getByRole('cell') }),
    ).toHaveCount(1);
  });
});
