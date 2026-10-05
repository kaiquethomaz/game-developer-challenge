import { expect, test, type Page } from '@playwright/test';
import {
  advance,
  advanceUntil,
  readState,
  startBattle,
  STEP_SECONDS,
  turnTowards,
} from './support/game';

async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await advance(page, STEP_SECONDS);
  await page.keyboard.up(key);
}

function playerProjectiles(state: Awaited<ReturnType<typeof readState>>) {
  return state.projectiles.filter((projectile) => projectile.faction === 'player');
}

test.describe('combat', () => {
  test.beforeEach(async ({ page }) => {
    await startBattle(page, { seed: 6, spawnIntervalSeconds: 10 });
  });

  test('front cannon fires a single projectile forward', async ({ page }) => {
    const before = await readState(page);
    await tap(page, 'Space');
    const after = await readState(page);
    const shots = playerProjectiles(after);
    expect(shots).toHaveLength(1);
    expect(shots[0]?.x).toBeGreaterThan(before.player.x);
    expect(shots[0]?.y).toBeCloseTo(before.player.y, 0);
  });

  test('side cannons fire three parallel projectiles to each side', async ({ page }) => {
    const { player } = await readState(page);

    await tap(page, 'KeyQ');
    const left = playerProjectiles(await readState(page));
    expect(left).toHaveLength(3);
    expect(left.every((projectile) => projectile.y < player.y)).toBe(true);
    expect(new Set(left.map((projectile) => Math.round(projectile.x))).size).toBe(3);

    await tap(page, 'KeyE');
    const all = playerProjectiles(await readState(page));
    const right = all.filter((projectile) => projectile.y > player.y);
    expect(right).toHaveLength(3);
  });

  test('each weapon respects its own cooldown while held', async ({ page }) => {
    await page.keyboard.down('Space');
    await advance(page, 0.3);
    expect(playerProjectiles(await readState(page))).toHaveLength(1);
    await advance(page, 0.2);
    expect(playerProjectiles(await readState(page))).toHaveLength(2);
    await page.keyboard.up('Space');

    await page.keyboard.down('KeyQ');
    await advance(page, 0.5);
    await page.keyboard.up('KeyQ');
    const state = await readState(page);
    expect(state.player.cooldowns.left).toBeGreaterThan(0);
    expect(playerProjectiles(state).filter((p) => p.y < state.player.y - 20)).toHaveLength(3);
  });

  test('the triple volley fans three balls forward and reloads before firing again', async ({
    page,
  }) => {
    const gauge = page.getByTestId('hud-volley');
    await expect(gauge).toHaveAccessibleName('Triple volley ready');
    const { player } = await readState(page);

    await page.keyboard.down('KeyR');
    await advance(page, 0.2);
    const fired = await readState(page);
    const volley = playerProjectiles(fired);
    expect(volley).toHaveLength(3);
    expect(volley.every((projectile) => projectile.x > player.x)).toBe(true);
    expect(new Set(volley.map((projectile) => Math.round(projectile.y))).size).toBe(3);
    expect(fired.player.cooldowns.volley).toBeGreaterThan(5);
    await expect(gauge).toHaveAccessibleName('Triple volley reloading');

    await advance(page, 3);
    expect(playerProjectiles(await readState(page))).toHaveLength(0);
    await advance(page, 3);
    await page.keyboard.up('KeyR');
    expect(playerProjectiles(await readState(page))).toHaveLength(3);
  });

  test('projectiles disappear after their range', async ({ page }) => {
    await tap(page, 'Space');
    await advance(page, 1.3);
    expect(playerProjectiles(await readState(page))).toHaveLength(0);
  });

  test('damages enemies and scores exactly one point per sunk ship', async ({ page }) => {
    const first = await advanceUntil(page, (state) => state.enemies.length > 0, 3);
    const target = first.enemies[0];
    if (!target) throw new Error('No enemy spawned');
    const maxHealth = target.health;
    const healthSeen = new Set<number>();
    let scoreHistory: number[] = [];

    for (let i = 0; i < 200; i += 1) {
      const state = await readState(page);
      const enemy = state.enemies.find((ship) => ship.id === target.id);
      scoreHistory.push(state.score);
      if (!enemy) break;
      healthSeen.add(enemy.health);
      await turnTowards(page, Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x), 0.08);
      await page.keyboard.down('Space');
      await advance(page, 0.1);
      await page.keyboard.up('Space');
    }

    const after = await readState(page);
    expect(after.enemies.find((ship) => ship.id === target.id)).toBeUndefined();
    expect([...healthSeen].some((health) => health > 0 && health < maxHealth)).toBe(true);
    expect(after.score).toBe(1);
    scoreHistory = scoreHistory.filter((score, index) => scoreHistory.indexOf(score) === index);
    expect(scoreHistory).toEqual([0, 1].slice(0, scoreHistory.length));

    await advance(page, 1.5);
    expect((await readState(page)).score).toBe(1);
    await expect(page.getByTestId('hud-score')).toHaveText('1');
  });
});
