import { expect, test } from '@playwright/test';
import { advanceUntil, readState, startBattle, STEP_SECONDS } from './support/game';

const ALL_CONTROLS = ['KeyW', 'KeyD', 'Space', 'KeyQ', 'KeyE'] as const;

test.describe('match end', () => {
  test('ends by time, freezes the simulation and shows the result', async ({ page }) => {
    await startBattle(page, { seed: 4, matchDurationSeconds: 60, spawnIntervalSeconds: 10 });
    for (const key of ALL_CONTROLS) await page.keyboard.down(key);
    await advanceUntil(page, (state) => state.elapsedSeconds >= 59, 60, 1);
    const { ended, frozen } = await page.evaluate((step) => {
      const probe = window.__pirateBattle;
      if (!probe) throw new Error('Battle probe is not available');
      for (let i = 0; i < 2 / step && probe.getState().status !== 'ended'; i += 1) {
        probe.advance(step);
      }
      const atEnd = probe.getState();
      for (let i = 0; i < 2 / step; i += 1) probe.advance(step);
      return { ended: atEnd, frozen: probe.getState() };
    }, STEP_SECONDS);
    for (const key of ALL_CONTROLS) await page.keyboard.up(key);

    expect(ended.status).toBe('ended');
    expect(ended.elapsedSeconds).toBe(60);
    expect(ended.remainingSeconds).toBe(0);
    expect(ended.player.alive).toBe(true);
    expect(frozen.player.x).toBe(ended.player.x);
    expect(frozen.player.y).toBe(ended.player.y);
    expect(frozen.score).toBe(ended.score);
    expect(frozen.enemies).toEqual(ended.enemies);
    expect(frozen.projectiles).toEqual(ended.projectiles);

    await expect(page.getByRole('heading', { name: 'Battle complete' })).toBeVisible();
    await expect(page.getByText(`${ended.score}`, { exact: true })).toBeVisible();
    await expect(page.getByText(/01:00 · Time up/)).toBeVisible();
  });

  test('ends by death when health reaches zero', async ({ page }) => {
    await startBattle(page, { seed: 4, matchDurationSeconds: 120, spawnIntervalSeconds: 10 });
    const ended = await advanceUntil(page, (state) => state.status === 'ended', 40, 1);
    expect(ended.player.health).toBe(0);
    expect(ended.player.alive).toBe(false);
    expect(ended.elapsedSeconds).toBeLessThan(120);
    await expect(page.getByTestId('battle-status')).toContainText('Battle over: Defeated');
    await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeVisible();
    await expect(page.getByText(/Defeated/)).toBeVisible();
  });

  test('play again starts a clean match', async ({ page }) => {
    await startBattle(page, { seed: 4, spawnIntervalSeconds: 10 });
    await advanceUntil(page, (state) => state.status === 'ended', 40, 1);
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.waitForFunction(() => window.__pirateBattle?.getState().status === 'running');

    const fresh = await readState(page);
    expect(fresh.elapsedSeconds).toBe(0);
    expect(fresh.score).toBe(0);
    expect(fresh.player.health).toBe(100);
    expect(fresh.enemies).toHaveLength(0);
    expect(fresh.projectiles).toHaveLength(0);
    await expect(page.getByTestId('hud-time')).toHaveText('02:00');
    await expect(page.locator('.battle canvas')).toHaveCount(1);
  });
});
