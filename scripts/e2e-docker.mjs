import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const version = lock.packages['node_modules/@playwright/test']?.version;
if (!version) throw new Error('@playwright/test is missing from package-lock.json');

const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const playwrightArgs = process.argv.slice(2).map((arg) => `'${arg.replaceAll("'", "'\\''")}'`);
const command = ['npm ci --no-audit --no-fund', `npx playwright test ${playwrightArgs.join(' ')}`];

const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--ipc=host',
    '--init',
    '-e',
    'CI=1',
    '-v',
    `${root}:/work`,
    '-v',
    'pirate-battle-node-modules:/work/node_modules',
    '-w',
    '/work',
    image,
    'bash',
    '-c',
    command.join(' && '),
  ],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
