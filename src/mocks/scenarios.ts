import { isRecord, readJson, removeKey, writeJson } from '../storage/localStore';

export const NETWORK_SCENARIOS = [
  'success',
  'empty',
  'many-pages',
  'slow',
  'variable-latency',
  'out-of-order',
  'timeout',
  'network-error',
  'server-error',
  'client-error',
  'ranking-error',
  'history-error',
  'record-timeout',
  'record-unavailable',
] as const;

export type NetworkScenario = (typeof NETWORK_SCENARIOS)[number];

export const SCENARIO_DESCRIPTIONS: Readonly<Record<NetworkScenario, string>> = {
  success: 'Everything works with the base latency.',
  empty: 'Ranking and history start without fixture data.',
  'many-pages': 'Large fixture set to exercise pagination.',
  slow: 'Every response takes about 2.5 seconds.',
  'variable-latency': 'Seeded random latency between 0.1 and 2 seconds.',
  'out-of-order': 'Older requests answer after newer ones.',
  timeout: 'Requests never answer and hit the client timeout.',
  'network-error': 'Connections fail before reaching the server.',
  'server-error': 'Every endpoint answers HTTP 500.',
  'client-error': 'Every endpoint answers HTTP 400.',
  'ranking-error': 'Only the ranking endpoint fails (HTTP 503).',
  'history-error': 'Only the match history endpoint fails (HTTP 503).',
  'record-timeout': 'Matches are stored but the first answer times out.',
  'record-unavailable': 'Match registration answers HTTP 503 until recovery.',
};

export interface MockSettings {
  readonly scenario: NetworkScenario;
  readonly latencyMs: number;
  readonly seed: number;
}

export const DEFAULT_MOCK_SETTINGS: MockSettings = { scenario: 'success', latencyMs: 250, seed: 1 };

const SETTINGS_KEY = 'pirate-battle:mock-settings';

export function isNetworkScenario(value: unknown): value is NetworkScenario {
  return typeof value === 'string' && (NETWORK_SCENARIOS as readonly string[]).includes(value);
}

export function loadMockSettings(): MockSettings {
  const stored = readJson(SETTINGS_KEY, parseSettings) ?? DEFAULT_MOCK_SETTINGS;
  const fromUrl = readUrlOverrides(stored);
  if (fromUrl !== stored) writeJson(SETTINGS_KEY, fromUrl);
  return fromUrl;
}

export function saveMockSettings(settings: MockSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function resetMockSettings(): void {
  removeKey(SETTINGS_KEY);
}

function readUrlOverrides(settings: MockSettings): MockSettings {
  const params = new URLSearchParams(window.location.search);
  const scenario = params.get('scenario');
  const latency = params.get('latency');
  const seed = params.get('mockSeed');
  if (scenario === null && latency === null && seed === null) return settings;

  return {
    scenario: isNetworkScenario(scenario) ? scenario : settings.scenario,
    latencyMs:
      latency !== null && Number.isFinite(Number(latency)) ? Number(latency) : settings.latencyMs,
    seed: seed !== null && Number.isFinite(Number(seed)) ? Number(seed) : settings.seed,
  };
}

function parseSettings(value: unknown): MockSettings | null {
  if (!isRecord(value)) return null;
  const { scenario, latencyMs, seed } = value;
  if (!isNetworkScenario(scenario) || typeof latencyMs !== 'number' || typeof seed !== 'number') {
    return null;
  }
  return { scenario, latencyMs, seed };
}
