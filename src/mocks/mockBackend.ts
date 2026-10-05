import type { MatchRecord } from '../api/contracts';
import { createRandom, type Random } from '../game/core/random';
import { isRecord, readJson, removeKey, writeJson } from '../storage/localStore';
import { createFixtureRecords } from './fixtures';
import {
  DEFAULT_MOCK_SETTINGS,
  loadMockSettings,
  resetMockSettings,
  saveMockSettings,
  type MockSettings,
  type NetworkScenario,
} from './scenarios';

const DB_KEY = 'pirate-battle:mock-db';
const FIXTURES_PER_CONFIG = 14;
const MANY_PAGES_FIXTURES_PER_CONFIG = 60;

type Listener = (settings: MockSettings) => void;

class MockBackend {
  private settings: MockSettings = DEFAULT_MOCK_SETTINGS;
  private random: Random = createRandom(DEFAULT_MOCK_SETTINGS.seed);
  private requestCount = 0;
  private readonly timedOutMatches = new Set<string>();
  private readonly listeners = new Set<Listener>();

  init(): void {
    this.applySettings(loadMockSettings());
  }

  getSettings(): MockSettings {
    return this.settings;
  }

  setScenario(scenario: NetworkScenario): void {
    this.applySettings({ ...this.settings, scenario });
    saveMockSettings(this.settings);
  }

  reset(): void {
    removeKey(DB_KEY);
    resetMockSettings();
    this.timedOutMatches.clear();
    this.applySettings(DEFAULT_MOCK_SETTINGS);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  nextRequestIndex(): number {
    this.requestCount += 1;
    return this.requestCount;
  }

  randomBetween(min: number, max: number): number {
    return this.random.range(min, max);
  }

  shouldTimeOutAfterSave(matchId: string): boolean {
    if (this.settings.scenario !== 'record-timeout' || this.timedOutMatches.has(matchId)) {
      return false;
    }
    this.timedOutMatches.add(matchId);
    return true;
  }

  allRecords(): MatchRecord[] {
    return [...this.fixtures(), ...this.storedRecords()];
  }

  storedRecords(): MatchRecord[] {
    return readJson(DB_KEY, parseRecords) ?? [];
  }

  persist(records: readonly MatchRecord[]): void {
    writeJson(DB_KEY, records);
  }

  private fixtures(): MatchRecord[] {
    switch (this.settings.scenario) {
      case 'empty':
        return [];
      case 'many-pages':
        return createFixtureRecords(MANY_PAGES_FIXTURES_PER_CONFIG);
      default:
        return createFixtureRecords(FIXTURES_PER_CONFIG);
    }
  }

  private applySettings(settings: MockSettings): void {
    this.settings = settings;
    this.random = createRandom(settings.seed);
    this.requestCount = 0;
    for (const listener of this.listeners) listener(settings);
  }
}

export const mockBackend = new MockBackend();

function parseRecords(value: unknown): MatchRecord[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(
    (item): item is MatchRecord =>
      isRecord(item) && typeof item.matchId === 'string' && typeof item.playerId === 'string',
  );
}
