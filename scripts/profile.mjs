import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'docs', 'performance');
const PORT = 4180;
const BASE_URL = `http://localhost:${PORT}`;
const VIEWPORT = { width: 1920, height: 1080 };
const MATCH = { matchDurationSeconds: 180, spawnIntervalSeconds: 3 };
const MEMORY_CYCLES = 5;
const MEMORY_CYCLE_SECONDS = 20;
const headed = process.argv.includes('--headed');

const BOT_SOURCE = `
(() => {
  const keys = new Set();
  const set = (code, down) => {
    if (down === keys.has(code)) return;
    if (down) keys.add(code); else keys.delete(code);
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
  };
  const tick = () => {
    const probe = window.__pirateBattle;
    if (!probe) return;
    const { player, enemies, status } = probe.getState();
    if (status !== 'running') return;
    let nearest = null;
    let best = Infinity;
    let left = false;
    let right = false;
    for (const enemy of enemies) {
      const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      const bearing = Math.atan2(Math.sin(angle - player.heading), Math.cos(angle - player.heading));
      if (distance < 360 && Math.abs(bearing + Math.PI / 2) < 0.4) left = true;
      if (distance < 360 && Math.abs(bearing - Math.PI / 2) < 0.4) right = true;
      if (distance < best) { best = distance; nearest = enemy; }
    }
    let turn = 1;
    let fire = false;
    let thrust = true;
    if (nearest) {
      const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      const error = Math.atan2(Math.sin(angle - player.heading), Math.cos(angle - player.heading));
      turn = error > 0.05 ? 1 : error < -0.05 ? -1 : 0;
      fire = Math.abs(error) < 0.15 && best < 560;
      thrust = best > 260;
    }
    set('KeyW', thrust);
    set('KeyA', turn < 0);
    set('KeyD', turn > 0);
    set('Space', fire);
    set('KeyQ', left);
    set('KeyE', right);
  };
  window.__profilerBot = setInterval(tick, 50);
})();
`;

const RECORDER_SOURCE = `
(() => {
  const frames = [];
  const samples = [];
  let last = performance.now();
  const loop = (now) => {
    frames.push(now - last);
    last = now;
    window.__profilerFrame = requestAnimationFrame(loop);
  };
  window.__profilerFrame = requestAnimationFrame(loop);
  window.__profilerSampler = setInterval(() => {
    const probe = window.__pirateBattle;
    if (!probe) return;
    const state = probe.getState();
    samples.push({
      t: state.elapsedSeconds,
      enemies: state.enemies.length,
      projectiles: state.projectiles.length,
      effects: state.render ? state.render.effects : 0,
      heap: performance.memory ? performance.memory.usedJSHeapSize : null,
    });
  }, 1000);
  window.__profilerResults = () => ({ frames, samples });
})();
`;

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

function summarize(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    average: values.length ? total / values.length : 0,
    max: values.length ? Math.max(...values) : 0,
  };
}

function round(value, digits = 2) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}

async function openPage(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await context.addInitScript((options) => {
    localStorage.setItem('pirate-battle:options', JSON.stringify(options));
    localStorage.setItem('pirate-battle:sound', 'false');
  }, MATCH);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return { context, page, errors };
}

async function gpuRenderer(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return 'WebGL unavailable';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
}

async function profileMatch(browser) {
  const { context, page, errors } = await openPage(browser);
  await page.goto(`${BASE_URL}/?e2e=1&seed=7&invulnerable=1&latency=0`);
  const renderer = await gpuRenderer(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail' }).click();
  await page.waitForFunction(() => window.__pirateBattle !== undefined);
  await page.evaluate(RECORDER_SOURCE);
  await page.evaluate(BOT_SOURCE);

  const startedAt = Date.now();
  await page.waitForFunction(() => window.__pirateBattle?.getState().status === 'ended', null, {
    timeout: (MATCH.matchDurationSeconds + 60) * 1000,
    polling: 1000,
  });
  const wallSeconds = (Date.now() - startedAt) / 1000;
  const { frames, samples } = await page.evaluate(() => window.__profilerResults());
  const finalState = await page.evaluate(() => window.__pirateBattle?.getState());
  await context.close();

  const frameTimes = frames.slice(30);
  const enemies = summarize(samples.map((sample) => sample.enemies));
  const projectiles = summarize(samples.map((sample) => sample.projectiles));
  const effects = summarize(samples.map((sample) => sample.effects));
  const entities = summarize(samples.map((s) => 1 + s.enemies + s.projectiles + s.effects));

  return {
    renderer,
    wallSeconds: round(wallSeconds, 1),
    simulatedSeconds: round(finalState?.elapsedSeconds ?? 0, 1),
    score: finalState?.score ?? 0,
    frames: frameTimes.length,
    averageFps: round(1000 / summarize(frameTimes).average, 1),
    frameTimeMs: {
      average: round(summarize(frameTimes).average),
      p50: round(percentile(frameTimes, 50)),
      p95: round(percentile(frameTimes, 95)),
      p99: round(percentile(frameTimes, 99)),
      max: round(summarize(frameTimes).max),
    },
    framesOver33ms: frameTimes.filter((value) => value > 33.4).length,
    entities: {
      enemies: { average: round(enemies.average, 1), max: enemies.max },
      projectiles: { average: round(projectiles.average, 1), max: projectiles.max },
      effects: { average: round(effects.average, 1), max: effects.max },
      total: { average: round(entities.average, 1), max: entities.max },
    },
    timeline: samples.map((sample) => ({
      t: round(sample.t, 0),
      enemies: sample.enemies,
      projectiles: sample.projectiles,
      effects: sample.effects,
    })),
    consoleErrors: errors,
  };
}

async function profileMemory(browser) {
  const { context, page, errors } = await openPage(browser);
  await page.goto(`${BASE_URL}/?e2e=1&seed=11&invulnerable=1&latency=0`);
  const measure = async (label) => {
    await page.evaluate(() => window.gc?.());
    await page.waitForTimeout(300);
    return page.evaluate(
      (name) => ({
        label: name,
        heapMb: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
        canvases: document.querySelectorAll('canvas').length,
        domNodes: document.getElementsByTagName('*').length,
      }),
      label,
    );
  };

  const snapshots = [await measure('menu (baseline)')];
  for (let cycle = 1; cycle <= MEMORY_CYCLES; cycle += 1) {
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Set sail' }).click();
    await page.waitForFunction(() => window.__pirateBattle !== undefined);
    await page.evaluate(BOT_SOURCE);
    await page.waitForTimeout(MEMORY_CYCLE_SECONDS * 1000);
    await page.evaluate(() => clearInterval(window.__profilerBot));
    snapshots.push({ ...(await measure(`cycle ${cycle} in battle`)) });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.waitForTimeout(500);
    snapshots.push(await measure(`cycle ${cycle} back in menu`));
  }
  await context.close();

  const menu = snapshots.filter((snapshot) => snapshot.label.includes('menu'));
  const first = menu[1]?.heapMb ?? 0;
  const last = menu[menu.length - 1]?.heapMb ?? 0;
  return {
    snapshots: snapshots.map((snapshot) => ({ ...snapshot, heapMb: round(snapshot.heapMb ?? 0) })),
    menuHeapGrowthAfterFirstCycleMb: round(last - first),
    consoleErrors: errors,
  };
}

function toMarkdown(report) {
  const { environment, match, memory } = report;
  const lines = [
    '# Performance profile',
    '',
    `Generated by \`npm run profile\` on ${report.generatedAt}.`,
    '',
    '## Environment',
    '',
    '| Item | Value |',
    '| --- | --- |',
    `| CPU | ${environment.cpu} (${environment.cores} logical cores) |`,
    `| Memory | ${environment.memoryGb} GB |`,
    `| OS | ${environment.os} |`,
    `| Browser | Chromium ${environment.browser} (${environment.mode}) |`,
    `| GPU / WebGL renderer | ${match.renderer} |`,
    `| Viewport | ${VIEWPORT.width}x${VIEWPORT.height} at device pixel ratio 1 |`,
    `| Build | Production build served by \`vite preview\` |`,
    `| Match | ${MATCH.matchDurationSeconds} s, enemy spawn every ${MATCH.spawnIntervalSeconds} s, seed 7 |`,
    '',
    '## Three minute match',
    '',
    'A scripted captain sails, aims at the nearest enemy and fires every weapon through real keyboard events. The player is flagged invulnerable so the full match runs under load; every other rule is unchanged.',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Simulated time | ${match.simulatedSeconds} s (wall clock ${match.wallSeconds} s) |`,
    `| Frames recorded | ${match.frames} |`,
    `| Average FPS | ${match.averageFps} |`,
    `| Frame time average / p50 / p95 / p99 / max | ${match.frameTimeMs.average} / ${match.frameTimeMs.p50} / ${match.frameTimeMs.p95} / ${match.frameTimeMs.p99} / ${match.frameTimeMs.max} ms |`,
    `| Frames slower than 33 ms | ${match.framesOver33ms} |`,
    `| Enemies average / max | ${match.entities.enemies.average} / ${match.entities.enemies.max} |`,
    `| Projectiles average / max | ${match.entities.projectiles.average} / ${match.entities.projectiles.max} |`,
    `| Effect sprites average / max | ${match.entities.effects.average} / ${match.entities.effects.max} |`,
    `| Total entities average / max | ${match.entities.total.average} / ${match.entities.total.max} |`,
    `| Score reached by the bot | ${match.score} |`,
    `| Console errors | ${match.consoleErrors.length} |`,
    '',
    '## Memory across five start, play and exit cycles',
    '',
    `Each cycle plays ${MEMORY_CYCLE_SECONDS} s of combat with the same bot, then leaves to the main menu. Heap values are taken after a forced garbage collection (\`--js-flags=--expose-gc\`).`,
    '',
    '| Snapshot | JS heap (MB) | Canvases | DOM nodes |',
    '| --- | --- | --- | --- |',
    ...memory.snapshots.map(
      (snapshot) =>
        `| ${snapshot.label} | ${snapshot.heapMb} | ${snapshot.canvases} | ${snapshot.domNodes} |`,
    ),
    '',
    `Menu heap growth between the first and the last cycle: **${memory.menuHeapGrowthAfterFirstCycleMb} MB**.`,
    '',
    'Raw data, including the per-second entity timeline, is in `profile-results.json`.',
    '',
    '## Investigation and limitations',
    '',
    '- **Memory.** The menu heap grows by a fraction of a megabyte per cycle while canvases and DOM nodes return to their baseline. `npm run profile:heap` compares retained heap snapshots by V8 node type between cycles 2 and 6 (see `HEAP-DIFF.md`). The growth is almost entirely `code` (functions compiled and optimized by the JIT as more paths run), while game objects, closures and arrays stay within a few kilobytes. No battle entity, Pixi object, texture or listener is retained after leaving a battle.',
    '- **Measurement setup.** Frames are measured with `requestAnimationFrame` in headless Chromium using the real GPU through ANGLE (Direct3D 11 on Windows). The display refresh caps the measurement at 60 fps, so the numbers show whether the target is held, not the maximum throughput. Without a GPU (SwiftShader software rendering) the same match drops to about 16 fps at 1920x1080, which is a limitation of software WebGL rather than of the game logic.',
    '- **Load.** The scripted captain sinks enemies quickly, so the default spawn interval keeps at most a handful of enemies alive. The configuration caps live enemies at 12; the shortest spawn interval (1 s) is the heaviest supported case.',
    '- **Invulnerability.** The profiling flag only skips damage to the player so the match lasts the full three minutes; spawning, enemy AI, collisions and effects run unchanged.',
    '',
  ];
  return lines.join('\n');
}

const server = await preview({ root, preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch({
  headless: !headed,
  args: [
    '--js-flags=--expose-gc',
    '--enable-precise-memory-info',
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
  ],
});

try {
  console.log('Profiling a three minute match…');
  const match = await profileMatch(browser);
  console.log(`  ${match.averageFps} fps, p95 ${match.frameTimeMs.p95} ms`);
  console.log('Profiling memory across five cycles…');
  const memory = await profileMemory(browser);
  console.log(`  menu heap growth ${memory.menuHeapGrowthAfterFirstCycleMb} MB`);

  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      cpu: os.cpus()[0]?.model.trim() ?? 'unknown',
      cores: os.cpus().length,
      memoryGb: round(os.totalmem() / 1024 ** 3, 1),
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      browser: browser.version(),
      mode: headed ? 'headed' : 'headless',
    },
    match,
    memory,
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'profile-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(outputDir, 'PROFILE.md'), toMarkdown(report));
  console.log('Wrote docs/performance/PROFILE.md and profile-results.json');
} finally {
  await browser.close();
  await server.close();
}
