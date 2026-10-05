import { expect, type Page } from '@playwright/test';
import type { GameStateProbe } from '../../../src/testing/e2eHooks';

export interface BattleSetup {
  readonly seed?: number;
  readonly matchDurationSeconds?: number;
  readonly spawnIntervalSeconds?: number;
  readonly scenario?: string;
  readonly manualClock?: boolean;
}

export const STEP_SECONDS = 1 / 60;

export async function storeOptions(
  page: Page,
  options: { matchDurationSeconds: number; spawnIntervalSeconds: number },
): Promise<void> {
  await page.goto('/?latency=0');
  await page.evaluate((value) => {
    localStorage.setItem('pirate-battle:options', JSON.stringify(value));
  }, options);
}

export function battleUrl(setup: BattleSetup = {}): string {
  const params = new URLSearchParams({ e2e: '1', latency: '0', seed: String(setup.seed ?? 1) });
  if (setup.manualClock ?? true) params.set('clock', 'manual');
  if (setup.scenario) params.set('scenario', setup.scenario);
  return `/?${params.toString()}`;
}

export async function startBattle(page: Page, setup: BattleSetup = {}): Promise<void> {
  if (setup.matchDurationSeconds !== undefined || setup.spawnIntervalSeconds !== undefined) {
    await storeOptions(page, {
      matchDurationSeconds: setup.matchDurationSeconds ?? 120,
      spawnIntervalSeconds: setup.spawnIntervalSeconds ?? 3,
    });
  }
  await page.goto(battleUrl(setup));
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => window.__pirateBattle !== undefined);
}

export async function readState(page: Page): Promise<GameStateProbe> {
  return page.evaluate(() => {
    const probe = window.__pirateBattle;
    if (!probe) throw new Error('Battle probe is not available');
    return probe.getState();
  });
}

export async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate(
    ({ total, step }) => {
      const probe = window.__pirateBattle;
      if (!probe) throw new Error('Battle probe is not available');
      for (let elapsed = 0; elapsed < total - 1e-9; elapsed += step) probe.advance(step);
    },
    { total: seconds, step: STEP_SECONDS },
  );
}

export async function holdKeys(
  page: Page,
  keys: readonly string[],
  seconds: number,
): Promise<void> {
  for (const key of keys) await page.keyboard.down(key);
  await advance(page, seconds);
  for (const key of keys) await page.keyboard.up(key);
}

export async function turnTowards(
  page: Page,
  targetAngle: number,
  tolerance = 0.04,
): Promise<void> {
  for (let i = 0; i < 400; i += 1) {
    const { player } = await readState(page);
    const error = Math.atan2(
      Math.sin(targetAngle - player.heading),
      Math.cos(targetAngle - player.heading),
    );
    if (Math.abs(error) <= tolerance) return;
    const key = error > 0 ? 'KeyD' : 'KeyA';
    await page.keyboard.down(key);
    await advance(page, STEP_SECONDS);
    await page.keyboard.up(key);
  }
  throw new Error(`Could not turn towards ${targetAngle}`);
}

export async function advanceUntil(
  page: Page,
  predicate: (state: GameStateProbe) => boolean,
  maxSeconds: number,
  chunkSeconds = 0.1,
): Promise<GameStateProbe> {
  let state = await readState(page);
  for (let elapsed = 0; elapsed < maxSeconds && !predicate(state); elapsed += chunkSeconds) {
    await advance(page, chunkSeconds);
    state = await readState(page);
  }
  expect(predicate(state), 'condition reached within the time limit').toBe(true);
  return state;
}

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
