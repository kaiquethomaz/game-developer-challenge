import { expect, test, type Page } from '@playwright/test';

async function openLog(page: Page, query: string, tab: 'Ranking' | 'Match history') {
  await page.goto(`/?${query}`);
  await page.getByRole('button', { name: tab, exact: true }).click();
}

function pager(page: Page) {
  return page.getByRole('navigation', { name: 'Ranking pages' });
}

function rankingRows(page: Page) {
  return page
    .getByRole('table')
    .getByRole('row')
    .filter({ has: page.getByRole('cell') });
}

test.describe("captain's log", () => {
  test('paginates the ranking ordered by score', async ({ page }) => {
    await openLog(page, 'latency=0&scenario=success', 'Ranking');
    await expect(page.getByText('120 second battles · 3 second spawn interval')).toBeVisible();
    await expect(rankingRows(page)).toHaveCount(5);
    await expect(pager(page).getByText('Page 1 of 3')).toBeVisible();

    const scores = await page.locator('.log-table__points').allInnerTexts();
    const numeric = scores.map(Number);
    expect(numeric).toEqual([...numeric].sort((a, b) => b - a));

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(pager(page).getByText('Page 2 of 3')).toBeVisible();
    await expect(rankingRows(page).first().getByRole('cell').first()).toHaveText('06');
    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(pager(page).getByText('Page 1 of 3')).toBeVisible();
  });

  test('keeps a separate ranking for each difficulty', async ({ page }) => {
    await openLog(page, 'latency=0&scenario=success', 'Ranking');
    await expect(page.getByText('Open Sea · 120 second battles')).toBeVisible();
    const openSeaLeader = await rankingRows(page).first().innerText();

    await page.evaluate(() => {
      localStorage.setItem(
        'pirate-battle:options',
        JSON.stringify({
          matchDurationSeconds: 120,
          spawnIntervalSeconds: 3,
          difficulty: 'kraken',
        }),
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Ranking', exact: true }).click();
    await expect(page.getByText("Kraken's Wrath · 120 second battles")).toBeVisible();
    await expect(rankingRows(page)).toHaveCount(5);
    expect(await rankingRows(page).first().innerText()).not.toBe(openSeaLeader);
  });

  test('switches tabs with the keyboard', async ({ page }) => {
    await openLog(page, 'latency=0', 'Ranking');
    const rankingTab = page.getByRole('tab', { name: 'Ranking' });
    await rankingTab.focus();
    await page.keyboard.press('ArrowRight');
    const historyTab = page.getByRole('tab', { name: 'Match history' });
    await expect(historyTab).toBeFocused();
    await expect(historyTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toContainText('Your recent battles');
  });

  test('shows a loading state while the server is slow', async ({ page }) => {
    await openLog(page, 'scenario=slow', 'Ranking');
    await expect(page.getByText('Loading ranking…')).toBeVisible();
    await expect(rankingRows(page)).toHaveCount(5, { timeout: 10_000 });
  });

  test('shows empty states', async ({ page }) => {
    await openLog(page, 'latency=0&scenario=empty', 'Ranking');
    await expect(page.getByText(/No battles recorded with this configuration yet/)).toBeVisible();
    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(page.getByText('You have not finished a battle yet.')).toBeVisible();
  });

  test('shows an accessible error with a retry when the ranking fails', async ({ page }) => {
    await openLog(page, 'latency=0&scenario=ranking-error', 'Ranking');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Could not load the ranking', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(page.getByText('You have not finished a battle yet.')).toBeVisible();
  });

  test('shows an error when the history fails while the game stays playable', async ({ page }) => {
    await openLog(page, 'latency=0&scenario=history-error', 'Match history');
    await expect(page.getByRole('alert')).toContainText('Could not load the match history', {
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByTestId('hud-time')).toBeVisible();
  });

  test('late answers never overwrite the page being shown', async ({ page }) => {
    await openLog(page, 'scenario=out-of-order', 'Ranking');
    await expect(pager(page).getByText('Page 1 of 3')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(pager(page).getByText('Page 2 of 3')).toBeVisible();
    await page.getByRole('button', { name: 'Previous page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();

    await page.waitForTimeout(2500);
    await expect(pager(page).getByText('Page 2 of 3')).toBeVisible();
    await expect(rankingRows(page).first().getByRole('cell').first()).toHaveText('06');
  });
});
